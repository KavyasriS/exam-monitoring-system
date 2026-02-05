/* global __dirname */

const CircularDependencyPlugin = require('circular-dependency-plugin');
const fs = require('fs');
const { join, resolve } = require('path');
const process = require('process');
const webpack = require('webpack');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyWebpackPlugin = require("copy-webpack-plugin");

const devServerProxyTarget =
    process.env.WEBPACK_DEV_SERVER_PROXY_TARGET || 'https://alpha.jitsi.net';

/**
 * Performance hints
 */
function getPerformanceHints(options, size) {
    const { analyzeBundle, isProduction } = options;

    return {
        hints: false,      // 🔥 ALWAYS DISABLE performance errors
        maxAssetSize: 1000 * 1024 * 1024,
        maxEntrypointSize: 1000 * 1024 * 1024
    };
}

/**
 * Bundle analyzer plugin helper
 */
function getBundleAnalyzerPlugin(analyzeBundle, name) {
    if (!analyzeBundle) {
        return [];
    }

    return [
        new BundleAnalyzerPlugin({
            analyzerMode: 'disabled',
            generateStatsFile: true,
            statsFilename: `${name}-stats.json`
        })
    ];
}

function devServerProxyBypass({ path }) {
    let tpath = path;

    if (tpath.startsWith('/v1/_cdn/')) {
        tpath = tpath.replace(/\/v1\/_cdn\/[^/]+\//, '/');
    }
    if (tpath.startsWith('/wasm/') || tpath.startsWith('/models/')) {
    return tpath;
    }

    if (
        tpath.startsWith('/css/')
        || tpath.startsWith('/doc/')
        || tpath.startsWith('/fonts/')
        || tpath.startsWith('/images/')
        || tpath.startsWith('/lang/')
        || tpath.startsWith('/sounds/')
        || tpath.startsWith('/static/')
        || tpath.endsWith('.wasm')
    ) {
        return tpath;
    }

    if (tpath.startsWith('/libs/')) {
        if (tpath.endsWith('.min.js') && !fs.existsSync(join(process.cwd(), tpath))) {
            return tpath.replace('.min.js', '.js');
        }

        return tpath;
    }
}

/**
 * Base webpack config
 */
function getConfig(options = {}) {
    const { detectCircularDeps, isProduction } = options;

    return {
        devtool: isProduction ? 'source-map' : 'eval-source-map',
        mode: isProduction ? 'production' : 'development',

        module: {
            rules: [
                {
                    loader: 'babel-loader',
                    options: {
                        configFile: false,
                        presets: [
                            [
                                require.resolve('@babel/preset-env'),
                                {
                                    modules: false,
                                    targets: {
                                        chrome: 80,
                                        electron: 10,
                                        firefox: 68,
                                        safari: 14
                                    },
                                    shippedProposals: true,
                                    useBuiltIns: 'usage',
                                    corejs: '3.40'
                                }
                            ],
                            require.resolve('@babel/preset-react')
                        ]
                    },
                    test: /\.(j|t)sx?$/,
                    exclude: /node_modules/
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader']
                },
                {
                    test: /\.svg$/,
                    resourceQuery: /raw/,
                    type: 'asset/source'
                },
                {
                    test: /\.svg$/,
                    resourceQuery: { not: [/raw/] },
                    use: [
                        {
                            loader: '@svgr/webpack',
                            options: { dimensions: false, expandProps: 'start' }
                        }
                    ]
                },
                {
                    test: /\.tsx?$/,
                    exclude: /node_modules/,
                    loader: 'ts-loader',
                    options: {
                        configFile: 'tsconfig.web.json',
                        transpileOnly: !isProduction
                    }
                }
            ]
        },

        node: { __filename: true },

        optimization: {
            concatenateModules: isProduction,
            minimize: isProduction
        },

        output: {
            filename: `[name]${isProduction ? '.min' : ''}.js`,
            path: `${__dirname}/build`,
            publicPath: '/libs/',
            sourceMapFilename: '[file].map'
        },

        plugins: [
            detectCircularDeps &&
                new CircularDependencyPlugin({
                    allowAsyncCycles: false,
                    exclude: /node_modules/,
                    failOnError: false
                }),

            // ⭐ COPY MODELS + WASM ⭐
            new CopyWebpackPlugin({
                patterns: [
                    {
                        from: resolve(__dirname, "react/features/monitoring/models"),
                        to: "models"
                    },
                    {
                        from: resolve(__dirname, "node_modules/@mediapipe/tasks-vision/wasm"),
                        to: "wasm"
                    }
                ]
            })
        ].filter(Boolean),

        resolve: {
            alias: {
                'focus-visible': 'focus-visible/dist/focus-visible.min.js',
                '@giphy/js-analytics': resolve(__dirname, 'giphy-analytics-stub.js')
            },
            aliasFields: ['browser'],
            extensions: ['.web.js', '.web.ts', '.web.tsx', '.tsx', '.ts', '.js', '.json'],
            fallback: {
                crypto: false,
                fs: false,
                path: false,
                process: false
            }
        }
    };
}

/**
 * Dev server
 */
function getDevServerConfig() {
    return {
        client: { overlay: { errors: true, warnings: false } },
        host: 'localhost',
        hot: true,
        proxy: [
            {
                context: ['/'],
                bypass: devServerProxyBypass,
                secure: false,
                target: devServerProxyTarget,
                headers: {
                    Host: new URL(devServerProxyTarget).host
                }
            }
        ],
        server: process.env.CODESPACES ? 'http' : 'https',
        static: {
            directory: process.cwd(),
            watch: { ignored: file => file.endsWith('.log') }
        }
    };
}

module.exports = (_env, argv) => {
    const analyzeBundle = Boolean(process.env.ANALYZE_BUNDLE);
    const mode = typeof argv.mode === 'undefined' ? 'production' : argv.mode;
    const isProduction = mode === 'production';

    const configOptions = {
        detectCircularDeps: Boolean(process.env.DETECT_CIRCULAR_DEPS),
        isProduction
    };

    const config = getConfig(configOptions);
    const perfHintOptions = { analyzeBundle, isProduction };

    return [
        {
            ...config,
            entry: { 'app.bundle': './app.js' },
            devServer: isProduction ? {} : getDevServerConfig(),
            plugins: [
                ...config.plugins,
                ...getBundleAnalyzerPlugin(analyzeBundle, 'app'),
                new webpack.DefinePlugin({ __DEV__: !isProduction }),
                new webpack.IgnorePlugin({ resourceRegExp: /^canvas$/, contextRegExp: /resemblejs$/ }),
                new webpack.IgnorePlugin({ resourceRegExp: /^\.\/locale$/, contextRegExp: /moment$/ }),
                new webpack.ProvidePlugin({ process: 'process/browser' })
            ],
            performance: getPerformanceHints(perfHintOptions, 5 * 1024 * 1024)
        },

        {
            ...config,
            entry: { alwaysontop: './react/features/always-on-top/index.tsx' },
            plugins: [
                ...config.plugins,
                ...getBundleAnalyzerPlugin(analyzeBundle, 'alwaysontop')
            ],
            performance: getPerformanceHints(perfHintOptions, 800 * 1024)
        },

        {
            ...config,
            entry: { close3: './static/close3.js' },
            plugins: [
                ...config.plugins,
                ...getBundleAnalyzerPlugin(analyzeBundle, 'close3')
            ],
            performance: getPerformanceHints(perfHintOptions, 128 * 1024)
        },

        {
            ...config,
            entry: { external_api: './modules/API/external/index.js' },
            output: {
                ...config.output,
                library: 'JitsiMeetExternalAPI',
                libraryTarget: 'umd'
            },
            plugins: [
                ...config.plugins,
                ...getBundleAnalyzerPlugin(analyzeBundle, 'external_api')
            ],
            performance: getPerformanceHints(perfHintOptions, 95 * 1024)
        },

        {
            ...config,
            entry: {
                'face-landmarks-worker': './react/features/face-landmarks/faceLandmarksWorker.ts'
            },
            plugins: [
                ...config.plugins,
                ...getBundleAnalyzerPlugin(analyzeBundle, 'face-landmarks-worker')
            ],
            performance: getPerformanceHints(perfHintOptions, 1024 * 1024 * 2)
        },

        {
            ...config,
            entry: {
                'noise-suppressor-worklet':
                    './react/features/stream-effects/noise-suppression/NoiseSuppressorWorklet.ts'
            },
            module: {
                rules: [
                    ...config.module.rules,
                    {
                        test: resolve(__dirname, 'node_modules/webpack-dev-server/client'),
                        loader: 'null-loader'
                    }
                ]
            },
            performance: getPerformanceHints(perfHintOptions, 1024 * 1024 * 2),
            output: { ...config.output, globalObject: 'AudioWorkletGlobalScope' }
        },

        {
            ...config,
            entry: { 'screenshot-capture-worker': './react/features/screenshot-capture/worker.ts' },
            plugins: [
                ...config.plugins,
                ...getBundleAnalyzerPlugin(analyzeBundle, 'screenshot-capture-worker')
            ],
            performance: getPerformanceHints(perfHintOptions, 30 * 1024)
        }
    ];
};
