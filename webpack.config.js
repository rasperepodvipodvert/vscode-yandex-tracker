const path = require('path');

function getWebviewConfig(mode) {
	/** @type {import('webpack').Configuration} */
	return {
		name: 'webview',
		mode: mode,
		entry: {
			index: './src/views/issueWebView/index.tsx'
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: 'ts-loader',
					exclude: /node_modules/
				},
				{
					test: /\.css$/,
					use: ['style-loader', 'css-loader']
				}
			]
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js']
		},
		devtool: mode === 'development' ? 'inline-source-map' : false,
		output: {
			filename: '[name].js',
			path: path.resolve(__dirname, 'media')
		}
	};
}

/**
 * @param {string} mode
 * @returns {import('webpack').Configuration}
 */
function getExtensionConfig(mode) {
	return {
		name: 'extension',
		mode: mode,
		target: 'node',
		entry: {
			extension: './src/extension.ts'
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					use: 'ts-loader',
					exclude: /node_modules/
				}
			]
		},
		resolve: {
			extensions: ['.tsx', '.ts', '.js']
		},
		devtool: mode === 'development' ? 'source-map' : false,
		output: {
			filename: '[name].js',
			path: path.resolve(__dirname, 'media'),
			libraryTarget: 'commonjs2',
			devtoolModuleFilenameTemplate: '../[resource-path]'
		},
		externals: {
			vscode: 'commonjs vscode'
		}
	};
}

module.exports = (env, argv) => {
	const mode = argv.mode || 'development';
	return [getExtensionConfig(mode), getWebviewConfig(mode)];
};
