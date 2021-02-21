import { GLRenderInfo } from './render';
import { Model, models } from './models';
import { mat4, vec3 } from 'gl-matrix';
import { initShader, initProgram } from './shader';
import vertSrc from './cursor_vert.glsl';
import fragSrc from './cursor_frag.glsl';

declare var gl: WebGL2RenderingContext;

const cursor = {
    _vao: null,
    _vbo: null,
    _ebo: null,
    _program: null,
    _loc_mvp: null,
    _loc_cursorPos: null,
    _loc_cursorSize: null,
    _loc_time: null,
    init: () => {
        const uvs = [];
        for (let i = 0; i < 6; i++) {
            uvs.push(1); uvs.push(1);
            uvs.push(1); uvs.push(0);
            uvs.push(2); uvs.push(1);
            uvs.push(2); uvs.push(0);
        }
        // const mat = mat4.create();
        // mat4.translate(mat, mat, [-0.5, -0.5, -0.5]);
        const glModel = Model.use(models.texturedCube, { nPerVertex: 2, data: uvs },
            null, false);

        cursor._vao = gl.createVertexArray();
        cursor._vbo = gl.createBuffer();
        cursor._ebo = gl.createBuffer();

        const vert = initShader('cursor_vert', vertSrc, gl.VERTEX_SHADER);
        const frag = initShader('cursor_frag', fragSrc, gl.FRAGMENT_SHADER);
        cursor._program = initProgram(vert, frag);
        cursor._loc_mvp = gl.getUniformLocation(cursor._program, 'mvp');
        cursor._loc_cursorPos = gl.getUniformLocation(cursor._program, 'cursorPos');
        cursor._loc_cursorSize = gl.getUniformLocation(cursor._program, 'cursorSize');
        cursor._loc_time = gl.getUniformLocation(cursor._program, 'time');

        gl.bindVertexArray(cursor._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, cursor._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, glModel.vertexData, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cursor._ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, glModel.indices, gl.STATIC_DRAW);
    },
    render: (info: GLRenderInfo, cursorPos: vec3, cursorSize: number) => {
        gl.disable(gl.DEPTH_TEST);
        gl.bindVertexArray(cursor._vao);
        gl.useProgram(cursor._program);
        gl.uniformMatrix4fv(cursor._loc_mvp, false, info.mvp);
        gl.uniform3f(cursor._loc_cursorPos, cursorPos[0], cursorPos[1], cursorPos[2]);
        gl.uniform1f(cursor._loc_cursorSize, cursorSize);
        gl.uniform1f(cursor._loc_time, info.time);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_INT, 0);
        gl.enable(gl.DEPTH_TEST);
    }
};
export default cursor;
