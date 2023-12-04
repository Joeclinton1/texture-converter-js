bl_info = {
    "name": "Vertex Index Shifter",
    "blender": (2, 80, 0),
    "category": "Mesh",
    "description": "Shift vertex indices within a selected polygon",
    "author": "Your Name",
    "version": (1, 0),
    "location": "3D View > Edit Mode > N-panel",
    "warning": "", # Used for warning icon and text in addons panel
}

import bpy
import bmesh

class ShiftVertexIndices(bpy.types.Operator):
    """Shift Vertex Indices of a Selected Polygon"""
    bl_idname = "mesh.shift_vertex_indices"
    bl_label = "Shift Vertex Indices"
    bl_options = {'REGISTER', 'UNDO'}

    shift_direction: bpy.props.EnumProperty(
        name="Direction",
        items=[
            ('LEFT', "Left", "Shift vertices left within the polygon"),
            ('RIGHT', "Right", "Shift vertices right within the polygon")
        ],
        default='RIGHT'
    )

    @classmethod
    def poll(cls, context):
        return context.active_object is not None and context.active_object.type == 'MESH' and context.active_object.mode == 'EDIT'

    def execute(self, context):
        obj = bpy.context.edit_object
        me = obj.data
        bm = bmesh.from_edit_mesh(me)

        faces = [f for f in bm.faces if f.select]
        if not faces or len(faces) > 1:
            self.report({'WARNING'}, "Select exactly one face")
            return {'CANCELLED'}

        selected_face = faces[0]
        verts = selected_face.verts[:]

        if self.shift_direction == 'RIGHT':
            verts.insert(0, verts.pop())  # Shift right
        else:
            verts.append(verts.pop(0))  # Shift left

        new_positions = [v.co.copy() for v in verts]
        for i, v in enumerate(selected_face.verts):
            v.co = new_positions[i]

        bmesh.update_edit_mesh(me)
        return {'FINISHED'}

class VIEW3D_PT_CustomPanel(bpy.types.Panel):
    bl_label = "Vertex Index Shifter"
    bl_idname = "VIEW3D_PT_custom_panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Edit'

    def draw(self, context):
        layout = self.layout
        layout.operator(ShiftVertexIndices.bl_idname, text="Shift Left").shift_direction = 'LEFT'
        layout.operator(ShiftVertexIndices.bl_idname, text="Shift Right").shift_direction = 'RIGHT'

def register():
    bpy.utils.register_class(ShiftVertexIndices)
    bpy.utils.register_class(VIEW3D_PT_CustomPanel)

def unregister():
    bpy.utils.unregister_class(ShiftVertexIndices)
    bpy.utils.unregister_class(VIEW3D_PT_CustomPanel)

if __name__ == "__main__":
    register()
