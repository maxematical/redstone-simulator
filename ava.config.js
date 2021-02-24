export default {
    files: [ 'test/*.ts' ],
    extensions: [ 'js' ], // .ts added automatically (somehow)
    require: [ 'esm' ], // https://stackoverflow.com/a/55803624
    typescript: {
        rewritePaths: {
            'test/': 'dist_test/'
        }
    }
};
