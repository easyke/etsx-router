// tslint:disable:max-classes-per-file
import EtsxRouter from '@etsx/router'
const anujs = require('anujs')

const run = ({ Component, createElement }) => {
  // 1. Define route components
  class Home extends Component {
    render() {
      return createElement('div', {}, 'home')
    }
  }
  class Foo extends Component {
    render() {
      return createElement('div', {}, 'foo')
    }
  }
  class Bar extends Component {
    render() {
      return createElement('div', {}, 'bar')
    }
  }
  class Unicode extends Component {
    render() {
      return createElement('div', {}, 'unicode')
    }
  }
  // 2. Create the router
  const router = new EtsxRouter({
    mode: 'history',
    base: __dirname,
    routes: [
      {
        path: '/',
        component: Home,
      },
      {
        path: '/foo',
        component: Foo,
      },
      {
        path: '/bar',
        component: Bar,
      },
      {
        path: '/é',
        component: Unicode,
      },
    ],
  })
  console.log('router', router)
  router.push('/foo')
  // 3. Create root app instance.
  return class App extends Component {
    constructor(...args) {
      super(...args)
      console.log(444, this.props)
    }
    render() {
      return (createElement('div', {}, 'ba3r'))
    }
  }
}




// 4. mount root instance.
// Make sure to inject the router.
// Route components will be rendered inside <router-view>.

anujs.render(anujs.createElement(run(anujs), { 'ss': '3' }), document.getElementById('app'))
// return;
// new Vue({
//   router,
//   template: `
//     <div id="app">
//       <h1>Basic</h1>
//       <ul>
//         <li><router-link to="/">/</router-link></li>
//         <li><router-link to="/foo">/foo</router-link></li>
//         <li><router-link to="/bar">/bar</router-link></li>
//         <router-link tag="li" to="/bar" :event="['mousedown', 'touchstart']">
//           <a>/bar</a>
//         </router-link>
//         <li><router-link to="/é">/é</router-link></li>
//         <li><router-link to="/é?t=%25ñ">/é?t=%ñ</router-link></li>
//         <li><router-link to="/é#%25ñ">/é#%25ñ</router-link></li>
//       </ul>
//       <pre id="query-t">{{ $route.query.t }}</pre>
//       <pre id="hash">{{ $route.hash }}</pre>
//       <router-view class="view"></router-view>
//     </div>
//   `
// }).$mount('#app')
