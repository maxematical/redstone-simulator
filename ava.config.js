export default {
    files: [ 'test/*.ts' ],
    extensions: [ 'js', '.ts' ],
    require: [
        'esm', // https://stackoverflow.com/a/55803624
        'source-map-support/register'
    ],
    typescript: {
        rewritePaths: {
            'test/': 'dist_test/test/'
        }
    }
};
