// tslint:disable:max-classes-per-file
import EtsxRouter from '@etsx/router'
const rax = require('rax')
console.log('\n\n------ begin: 5555 ------')
console.log(rax, EtsxRouter)
console.log('------ end: 5555 ------\n\n')

// 2. Define route components
const getRoutes = (createElement, Component) => [
  {
    path: '/',
    component: class Home extends Component {
      render() {
        return createElement('div', {}, 'home')
      }
    },
  },
  {
    path: '/foo',
    component: class Foo extends Component {
      render() {
        return createElement('div', {}, 'foo')
      }
    },
  },
  {
    path: '/bar',
    component: class Bar extends Component {
      render() {
        return createElement('div', {}, 'bar')
      }
    },
  },
  {
    path: '/é',
    component: class Unicode extends Component {
      render() {
        return createElement('div', {}, 'unicode')
      }
    },
  },
]

// 3. Create the router
const router = new EtsxRouter({
  mode: 'history',
  base: __dirname,
  routes: getRoutes(rax.createElement, rax.Component),
})

const View = router.View

// 4. Create and mount root instance.
// Make sure to inject the router.
// Route components will be rendered inside <router-view>.

const getApp = ({ Component, createElement }) => class App extends Component {
  render() {
    return (createElement('div', {}, 'bar'))
  }
}
render()
new Vue({
  router,
  template: `
    <div id="app">
      <h1>Basic</h1>
      <ul>
        <li><router-link to="/">/</router-link></li>
        <li><router-link to="/foo">/foo</router-link></li>
        <li><router-link to="/bar">/bar</router-link></li>
        <router-link tag="li" to="/bar" :event="['mousedown', 'touchstart']">
          <a>/bar</a>
        </router-link>
        <li><router-link to="/é">/é</router-link></li>
        <li><router-link to="/é?t=%25ñ">/é?t=%ñ</router-link></li>
        <li><router-link to="/é#%25ñ">/é#%25ñ</router-link></li>
      </ul>
      <pre id="query-t">{{ $route.query.t }}</pre>
      <pre id="hash">{{ $route.hash }}</pre>
      <router-view class="view"></router-view>
    </div>
  `
}).$mount('#app')
