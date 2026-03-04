import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    entry: './src/vendor/virtual-scroller-entry.js',
    output: {
        filename: 'virtual-scroller.bundle.js',
        path: path.resolve(__dirname, 'dist'),
        module: true,
        library: {
            type: 'module',
        },
        environment: {
            module: true,
        },
    },
    experiments: {
        outputModule: true,
    },
    target: ['web', 'es2020'],
    optimization: {
        minimize: true,
    },
};