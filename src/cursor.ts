import { GLRenderInfo } from './render';
import { Model, models } from './models';
import { mat4, vec3, ReadonlyVec3 } from 'gl-matrix';
import { initShader, initProgram } from './shader';
import directions from './directions';

const cursor = {
    _vao: null,
    _vbo: null,
    _ebo: null,
    _program: null,
    _loc_mvp: null,
    _loc_cursorPos: null,
    _loc_cursorSize: null,
    _loc_time: null,
    _loc_renderFaces: null,
    _renderFaces: null,
    init: () => {
        const vd = [];
        for (let i = 0; i < 6; i++) {
            // U        V           Face num
            vd.push(1); vd.push(1); vd.push(i);
            vd.push(1); vd.push(0); vd.push(i);
            vd.push(2); vd.push(1); vd.push(i);
            vd.push(2); vd.push(0); vd.push(i);
        }
        const glModel = Model.use(models.texturedCube, { nPerVertex: 3, data: vd },
            null, false);

        cursor._vao = gl.createVertexArray();
        cursor._vbo = gl.createBuffer();
        cursor._ebo = gl.createBuffer();

        const vert = initShader('cursor_vert', cursorVertSrc, gl.VERTEX_SHADER);
        const frag = initShader('cursor_frag', cursorFragSrc, gl.FRAGMENT_SHADER);
        cursor._program = initProgram(vert, frag);
        cursor._loc_mvp = gl.getUniformLocation(cursor._program, 'mvp');
        cursor._loc_cursorPos = gl.getUniformLocation(cursor._program, 'cursorPos');
        cursor._loc_cursorSize = gl.getUniformLocation(cursor._program, 'cursorSize');
        cursor._loc_time = gl.getUniformLocation(cursor._program, 'time');
        cursor._loc_renderFaces = gl.getUniformLocation(cursor._program, 'renderFaces');
        cursor._renderFaces = new Float32Array(6);
        for (let i = 0; i < 6; i++) cursor._renderFaces[i] = 1;

        gl.bindVertexArray(cursor._vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, cursor._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, glModel.vertexData, gl.STATIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        gl.enableVertexAttribArray(2);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cursor._ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, glModel.indices, gl.STATIC_DRAW);
    },
    render: (info: GLRenderInfo, cursorPos: vec3, cursorSize: number) => {
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.bindVertexArray(cursor._vao);
        gl.useProgram(cursor._program);
        gl.uniformMatrix4fv(cursor._loc_mvp, false, info.mvp);
        gl.uniform3f(cursor._loc_cursorPos, cursorPos[0], cursorPos[1], cursorPos[2]);
        gl.uniform1f(cursor._loc_cursorSize, cursorSize);
        gl.uniform1f(cursor._loc_time, info.time);
        gl.uniform1fv(cursor._loc_renderFaces, cursor._renderFaces, 0, 6);
        gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_INT, 0);
        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);
    },
    setShowFace: (faceDirection: ReadonlyVec3, show: boolean) => {
        let index: number;
        if (faceDirection === directions.west) index = 1;
        else if (faceDirection === directions.east) index = 2;
        else if (faceDirection === directions.north) index = 3;
        else if (faceDirection === directions.south) index = 4;
        else if (faceDirection === directions.up) index = 0;
        else if (faceDirection === directions.down) index = 5;
        cursor._renderFaces[index] = show ? 1 : 0;
    },
    showAllFaces: () => {
        for (let i = 0; i < 6; i++)
            cursor._renderFaces[i] = 1;
    }
};
export default cursor;
