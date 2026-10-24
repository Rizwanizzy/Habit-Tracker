import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

const bg = { r: 7, g: 10, b: 18, alpha: 1 } // #070A12

export default defineConfig({
  images: ['public/logo.png'],
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: bg },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: bg },
    },
  },
  headLinkOptions: {
    basePath: '/',
  },
  manifestIconsEntry: true,
})
