import App from './App.svelte'
import './styles/global.sass'
import { mount } from 'svelte'

const app = mount(App, {
  target: document.body,
})

export default app
