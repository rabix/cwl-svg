const webpack = require("webpack");

/**
 * @type {{entry: string, output: {filename: string}, module: {rules: *[]}, resolve: {extensions: string[]}, plugins: *[], devtool: string}}
 */
module.exports = {
    entry: './src/demo.ts',
    output: {
        filename: 'dist/bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/
            },
            {
                enforce: 'pre',
                test: /\.js$/,
                loader: "source-map-loader"
            },
            {
                enforce: 'pre',
                test: /\.tsx?$/,
                use: "source-map-loader"
            },

            {
                test: /\.scss$/,
                use: [{
                    loader: "style-loader" // creates style nodes from JS strings
                }, {
                    loader: "css-loader" // translates CSS into CommonJS
                }, {
                    loader: "sass-loader" // compiles Sass to CSS
                }]
            },
            {
                test: /\.json$/,
                use: 'json-loader'
            }
        ]
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".scss"]
    },

    plugins: [
        new webpack.ProvidePlugin({
            "samples.rnaSeqAlignment": "./../cwl-samples/rna-seq-alignment.json",
            "samples.bcBio": "./../cwl-samples/bcbio.json",
            "samples.fastQC": "./../cwl-samples/fastqc.json",
        })
    ],
    devtool: 'inline-source-map',
};