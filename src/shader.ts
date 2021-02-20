declare var gl: WebGL2RenderingContext;

export const initShader = (name: string, src: string, type: number): WebGLShader => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(`Error compiling shader ${name}`, gl.getShaderInfoLog(shader));
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
        console.log('Error linking program', gl.getProgramInfoLog(program));
        alert('Program linkage error');
        return null;
    }
    return program;
};