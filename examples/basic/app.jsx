// tslint:disable:max-classes-per-file
import Router from '@etsx/router'
import raxjsPropTypes from 'rax-proptypes'
const ReactDOM = require('react-dom');
const raxjs = require('rax')
const DriverDOM = require('driver-dom')
const reactPropTypes = require('prop-types')
const react = require('react')
const anujs = require('anujs')
const anujsPropTypes = require('anujs/lib/ReactPropTypes')
console.log('anujs', anujs)
console.log('raxjs', raxjs)
console.log('react', react)
const run = ({ Component, createElement, cloneElement }, PropTypes) => {
  // 1. Define route components
  class Home extends Component {
    render() {
      return createElement('div', {}, 'home')
    }
    beforeRouteUpdate(to, from, next) {
      console.log('\nbeforeRouteUpdate-Home-在当前路由改变，但是该组件被复用时调用')
      next()
    }
    beforeRouteLeave(to, from, next) {
      console.log('\nbeforeRouteLeave-Home-导航离开该组件的对应路由时调用')
      next()
    }
    beforeRouteEnter(to, from, next) {
      console.log('\nbeforeRouteEnter-Home-因为当守卫执行前，组件实例还没被创建')
      next()
    }
  }
  class Foo extends Component {
    render() {
      return createElement('div', {}, 'foo')
    }
    beforeRouteUpdate(to, from, next) {
      console.log('\nbeforeRouteUpdate-Foo-在当前路由改变，但是该组件被复用时调用')
      next()
    }
    beforeRouteLeave(to, from, next) {
      console.log('\nbeforeRouteLeave-Foo-导航离开该组件的对应路由时调用')
      next()
    }
    beforeRouteEnter(to, from, next) {
      console.log('\nbeforeRouteEnter-Foo-因为当守卫执行前，组件实例还没被创建')
      next()
    }
  }
  class Bar extends Component {
    render() {
      return createElement('div', {}, 'bar')
    }
    beforeRouteUpdate(to, from, next) {
      console.log('\nbeforeRouteUpdate-Bar-在当前路由改变，但是该组件被复用时调用')
      next()
    }
    beforeRouteLeave(to, from, next) {
      console.log('\nbeforeRouteLeave-Bar-导航离开该组件的对应路由时调用')
      next()
    }
    beforeRouteEnter(to, from, next) {
      console.log('\nbeforeRouteEnter-Bar-因为当守卫执行前，组件实例还没被创建')
      next()
    }
  }
  class Unicode extends Component {
    render() {
      return createElement('div', {}, 'unicode')
    }
    beforeRouteUpdate(to, from, next) {
      console.log('\nbeforeRouteUpdate-Unicode-在当前路由改变，但是该组件被复用时调用')
      next()
    }
    beforeRouteLeave(to, from, next) {
      console.log('\nbeforeRouteLeave-Unicode-导航离开该组件的对应路由时调用')
      next()
    }
    beforeRouteEnter(to, from, next) {
      console.log('\nbeforeRouteEnter-Unicode-因为当守卫执行前，组件实例还没被创建')
      next()
    }
  }
  // 2. Create the router
  const router = new Router({
    mode: 'history',
    base: __dirname,
    routes: [
      {
        path: '/',
        component: Home,
      },
      {
        path: '/foo',
        component: () => Promise.resolve(Foo),
        async: true,
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
  const RouterLink = router.getLink({ Component, createElement, cloneElement, PropTypes })
  const RouterView = router.getView({ Component, createElement, PropTypes })
  console.log('router', router)
  // router.push('/foo')

  // 3. Create root app instance.
  return class App extends Component {
    constructor(...args) {
      super(...args)
      console.log(444, this.props)
    }
    componentWillMount() {
      router.init()
    }
    render() {
      return (<div id="app">
        <h1>Basic</h1>
        <ul>
          <li><RouterLink to="/">/</RouterLink></li>
          <li><RouterLink to="/foo">/foo</RouterLink></li>
          <li><RouterLink to="/bar">/bar</RouterLink></li>
          <RouterLink tag="li" to="/bar" event={['onMouseDown', 'onTouchStart']}>
            <a>/bar</a>
          </RouterLink>
          <li><RouterLink to="/é">/é</RouterLink></li>
          <li><RouterLink to="/é?t=%25ñ">/é?t=%ñ</RouterLink></li>
          <li><RouterLink to="/é#%25ñ">/é#%25ñ</RouterLink></li>
        </ul>
        <pre id="query-t">{router.currentRoute.query.t}</pre>
        <pre id="hash">{router.currentRoute.hash}</pre>
        <RouterView className="view"></RouterView>
      </div>)
    }
  }
}




// 4. mount root instance.
// Make sure to inject the router.
// Route components will be rendered inside <router-view>.

anujs.render(anujs.createElement(run(anujs, anujsPropTypes), { 'ss': '3' }), document.getElementById('anujs'))

raxjs.render(raxjs.createElement(run(raxjs, raxjsPropTypes), { 'ss': '3' }), document.getElementById('raxjs'), {
  driver: DriverDOM
})
ReactDOM.render(react.createElement(run(react, reactPropTypes), { 'ss': '3' }), document.getElementById('react'))
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
