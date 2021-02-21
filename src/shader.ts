declare var gl: WebGL2RenderingContext;

export const initShader = (name: string, src: string, type: number): WebGLShader => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(`Error compiling shader ${name}`, gl.getShaderInfoLog(shader));
        console.error(src);
        alert(`Shader compilation error: ${name}`);
        return null;
    }
    return shader;
};

export const initProgram = (vert: WebGLShader, frag: WebGLShader): WebGLProgram => {
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Error linking program', gl.getProgramInfoLog(program));
        alert('Program linkage error');
        return null;
    }
    return program;
};