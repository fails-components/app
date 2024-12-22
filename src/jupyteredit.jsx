/*
    Fails Components (Fancy Automated Internet Lecture System - Components)
    Copyright (C)  2015-2017 (original FAILS), 
                   2021- (FAILS Components)  Marten Richter <marten.richter@freenet.de>

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as
    published by the Free Software Foundation, either version 3 of the
    License, or (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/
import React, { Component, Fragment } from 'react'
import testData from './example.ipynb?raw'
import './jupyteredit.css'

const jupyterurl = 'http://127.0.0.1:8000/index.html'

export class JupyterEdit extends Component {
  constructor(props) {
    super(props)
    this.state = { dirty: false, appLoading: true, appid: undefined }
    this.onMessage = this.onMessage.bind(this)
    if (props.stateCallback) props.stateCallback({ dirty: false })
    this._requestId = 1 // id, if we request something
    this._requests = new Map()
  }

  componentDidMount() {
    window.addEventListener('message', this.onMessage)
  }

  componentWillUnmount() {
    window.removeEventListener('message', this.onMessage)
  }

  loadJupyter() {
    const data = JSON.parse(testData)
    if (data?.metadata?.kernelspec) {
      const kernelspec = data?.metadata?.kernelspec
      if (kernelspec?.name !== 'python' && kernelspec?.name !== 'xpython') {
        // replace the kernel
        kernelspec.name = 'python'
        kernelspec.display_name = 'Python (Pyodide)'
        kernelspec.language = 'python'
        kernelspec.name = 'python'
      }
    }
    this.sendToIFrame({
      type: 'loadJupyter',
      inLecture: false,
      fileName: 'example.ipynb',
      fileData: data,
      kernelName: 'python'
    })
  }

  async saveJupyter() {
    return this.sendToIFrameAndReceive({
      type: 'saveJupyter',
      fileName: 'example.ipynb'
    })
  }

  activateApp(appid) {
    this.setState({ appid })
    return this.sendToIFrameAndReceive({
      type: 'activateApp',
      inLecture: !!appid,
      appid
    })
  }

  async getLicenses() {
    return this.sendToIFrameAndReceive({
      type: 'getLicenses'
    })
  }

  async restartKernelAndRunCells() {
    return this.sendToIFrameAndReceive({
      type: 'restartKernelAndRerunCells'
    })
  }

  onMessage(event) {
    if (event.origin !== new URL(jupyterurl).origin) return
    const data = event.data
    if (event.data.requestId) {
      const requestId = event.data.requestId
      if (this._requests.has(requestId)) {
        const request = this._requests.get(requestId)
        this._requests.delete(requestId)
        if (event.data.error) {
          request.reject(new Error(event.data.error))
          return
        }
        request.resolve(event.data)
        return
      }
    }
    switch (data?.task) {
      case 'appLoaded':
        this.setState({ appLoading: false })
        this.loadJupyter()
        break
      case 'docDirty':
        {
          const { dirty = undefined } = data
          if (this.props.stateCallback && typeof dirty !== 'undefined') {
            this.props.stateCallback({ dirty })
          }
        }
        break
      case 'reportMetadata':
        {
          const { failsApp = undefined, kernelspec = undefined } =
            data?.metadata
          if (
            this.props.stateCallback &&
            (typeof failsApp !== 'undefined' ||
              typeof kernelspec !== 'undefined')
          ) {
            this.props.stateCallback({ failsApp, kernelspec })
          }
        }
        break
      case 'reportFailsAppletSizes':
        {
          const { appletSizes = undefined } = data
          if (typeof appletSizes !== 'undefined') {
            this.setState((state) => {
              const retState = {}
              for (const appletSize of Object.values(appletSizes)) {
                const { appid, height, width } = appletSize
                if (state?.appletSizes?.[appid]) {
                  const oldsize = state.appletSizes[appid]
                  if (oldsize.height === height && oldsize.width === width)
                    continue
                }
                if (!retState.appletSizes) retState.appletSizes = {}
                retState.appletSizes[appid] = { width, height }
              }
              return retState
            })
          }
        }
        break
      default:
    }
  }

  sendToIFrame(message) {
    if (this.iframe) this.iframe.contentWindow.postMessage(message, jupyterurl)
  }

  async sendToIFrameAndReceive(message) {
    const requestId = this._requestId++
    return new Promise((resolve, reject) => {
      this._requests.set(requestId, {
        requestId,
        resolve,
        reject
      })
      this.sendToIFrame({
        requestId,
        ...message
      })
    })
  }

  render() {
    // launch debugging in the following way:
    // jupyter lab --allow-root --ServerApp.allow_origin='*' --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': 'frame-ancestors self *'}}" --ServerApp.allow_websocket_origin='*' --ServerApp.cookie_options="{'samesite': 'None', 'secure': True}"
    // jupyter lab --allow-root --ServerApp.allow_origin='*' --ServerApp.tornado_settings="{'headers': {'Content-Security-Policy': 'frame-ancestors self *'}}" --ServerApp.allow_websocket_origin='*' --ServerApp.cookie_options="{'samesite': 'None', 'secure': True}" --LabServerApp.app_settings_dir=/workspaces/jupyterfails/development/config/app-edit
    // do it only in a container!

    if (!this.props.editActivated) {
      return <Fragment>JupyterEdit is not activated</Fragment>
    }
    let width = '100%'
    let height = '99%'

    if (this.state.appid) {
      const appletSize =
        this.state.appletSizes && this.state.appletSizes[this.state.appid]
      if (appletSize) {
        width = Math.ceil(appletSize.width * 1.01) + 'px'
        height = Math.ceil(appletSize.height * 1.01) + 'px'
      }
    }

    return (
      <Fragment>
        <iframe
          style={{ width, height }}
          className='jpt-edit-iframe'
          src={jupyterurl || this.props.jupyterurl}
          ref={(el) => {
            this.iframe = el
          }}
          onLoad={this.onIFrameLoad}
          allow=''
          credentialless='true'
          sandbox='allow-scripts allow-downloads allow-same-origin allow-popups' // we need allow-forms for a local jupyter server, remove for jupyterlite
          title='jupyteredit'
        ></iframe>
        {this.state.appLoading && (
          <h2
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }}
          >
            Jupyter is loading, be patient...
          </h2>
        )}
      </Fragment>
    )
  }
}
