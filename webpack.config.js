const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const path = require('path');

/** @type {import('webpack').Configuration} */ // <-- enables VSCode autocomplete
module.exports = {
    mode: 'development',
    devtool: 'source-map',
    entry: __dirname + '/src/index.ts',
    output: {
        path: __dirname + '/dist',
        publicPath: __dirname + '/dist',
        filename: 'src.bundle.js'
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: 'src/index.html',
            publicPath: '.' // use relative paths
        }),
        new MiniCssExtractPlugin()
    ],
    module: {
        rules: [
            { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
            // { test: /\.html$/, type: 'asset/resource', generator: { filename: 'index.html' } },
            { test: /\.png$/, loader: 'file-loader', options: {
                publicPath: (url, resourcePath, context) => url
            } },
            { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader'] },
            // { test: /\.glsl$/, type: 'asset/resource', use: ['glslify-loader'] },
            { test: /\.glsl$/, use: ['raw-loader', 'glslify-loader'] },
        ]
    },
    resolve: { extensions: ['.js', '.ts'] },
    devServer: {
        publicPath: '/',
        writeToDisk: true
    }
};
