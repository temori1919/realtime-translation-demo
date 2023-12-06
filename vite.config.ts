import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // VADを使用するために静的ファイルを参照する必要があるため追加
    // @see https://github.com/ricky0123/vad/issues/9
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js',
          dest: '/'
        },
        {
          src: 'node_modules/@ricky0123/vad-web/dist/silero_vad.onnx',
          dest: '/'
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: '/'
        }
      ]
    }),
  ],
})
