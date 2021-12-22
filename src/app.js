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

import React, { Component } from 'react'
import { Button } from 'primereact/button'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Card } from 'primereact/card'
import { Tree } from 'primereact/tree'
import { InputText } from 'primereact/inputtext'
import { Galleria } from 'primereact/galleria'
import { ScrollPanel } from 'primereact/scrollpanel'
import { Calendar } from 'primereact/calendar'
import { Dialog } from 'primereact/dialog'
import { Toast } from 'primereact/toast'
import { FileUpload } from 'primereact/fileupload'
import { locale, addLocale } from 'primereact/api'
import { ToggleButton } from 'primereact/togglebutton'
import { confirmDialog } from 'primereact/confirmdialog'
import { OverlayPanel } from 'primereact/overlaypanel'
// eslint-disable-next-line camelcase
import jwt_decode from 'jwt-decode'
import axios from 'axios'
import moment from 'moment'
import Pica from 'pica'
import ImageBlobReduce from 'image-blob-reduce'
import { PDFGenerator } from './pdfgenerator'
import fileDownload from 'js-file-download'
import { FailsConfig } from '@fails-components/config'
import failsLogo from './logo/logo2.svg'
import failsLogoLong from './logo/logo1.svg'

window.parent.postMessage(
  JSON.stringify({ subject: 'lti.frameResize', height: '90vh' }),
  '*'
) // tell the lms that the frame should be big, if the lms support this kind of message

const pica = Pica({ features: ['js', 'wasm', 'cib'] })
const reduce = new ImageBlobReduce({ pica })

const cfg = new FailsConfig({ react: true })

axios.defaults.baseURL = cfg.getURL('app')

console.log('process env', process.env)

console.log('axios base', axios.defaults.baseURL, cfg.getURL('app'))

addLocale('de', {
  firstDayOfWeek: 1,
  dayNames: [
    'Sonntag',
    'Montag',
    'Dienstag',
    'Mittwoch',
    'Donnerstag',
    'Freitag',
    'Samstag'
  ],
  dayNamesShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  dayNamesMin: ['S', 'M', 'D', 'M', 'D', 'F', 'S'],
  monthNames: [
    'Januar',
    'Februar',
    'März',
    'April',
    'Mai',
    'Juni',
    'Juli',
    'August',
    'September',
    'Oktober',
    'November',
    'Dezember'
  ],
  monthNamesShort: [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mai',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dez'
  ],
  today: 'Heute',
  clear: 'Leer',
  dateFormat: 'dd.mm.yy'
})
locale('de')

class App extends Component {
  constructor(args) {
    super(args)
    this.state = {}

    this.state.pictures = null
    this.state.pictIndex = 0
    this.state.showrenew = false
    this.state.selLecture = null
    this.state.polledittext = {}
    this.state.ispolledit = {}

    this.pictureupload = React.createRef()
    this.bgpdfupload = React.createRef()

    // get query string
    {
      const search = window.location.search.substring(1) // skip ?
      const pair = search.split('&').find((el) => el.split('=')[0] === 'token')
      if (pair) this.state.token = pair.split('=')[1]
      if (this.state.token)
        this.state.decoded_token = jwt_decode(this.state.token)
      console.log('this.state.decoded', this.state.decoded_token)
    }

    this.pollTemplate = this.pollTemplate.bind(this)
    this.lectureTemplate = this.lectureTemplate.bind(this)

    this.itemGalleriaTemplate = this.itemGalleriaTemplate.bind(this)
    this.thumbnailGalleriaTemplate = this.thumbnailGalleriaTemplate.bind(this)
    this.renewToken = this.renewToken.bind(this)
    this.openNotebook = this.openNotebook.bind(this)
    this.openNotebookWarn = this.openNotebookWarn.bind(this)
    this.openStudentNotes = this.openStudentNotes.bind(this)

    this.uploadPicture = this.uploadPicture.bind(this)
    this.uploadBgpdf = this.uploadBgpdf.bind(this)

    this.patchLectureDetails = this.patchLectureDetails.bind(this)

    this.onChangeCalendar = this.onChangeCalendar.bind(this)
    this.changePoll = this.changePoll.bind(this)

    this.pdfGenerate = this.pdfGenerate.bind(this)
    this.downloadPDF = this.downloadPDF.bind(this)

    this.doCopy = this.doCopy.bind(this)

    this.checkTokenRenew = this.checkTokenRenew.bind(this)
  }

  axiosConfig() {
    const config = {}
    config.headers = { authorization: 'Bearer ' + this.state.token }
    return config
  }

  componentDidMount() {
    this.renewToken()
    this.getLectureDetails()

    if (
      this.state.decoded_token &&
      this.state.decoded_token.role.includes('instructor')
    ) {
      this.getLectures()
    }

    if (this.tokentimerid) {
      window.clearInterval(this.tokentimerid)
      delete this.tokentimerid
    }
    this.tokentimerid = window.setInterval(this.checkTokenRenew, 1000)
  }

  onChangeCalendar(e) {
    console.log('onChangeCal', e)
    this.patchLectureDetails({ date: e.value })
  }

  errorMessage(error) {
    console.log('Error', error)
    if (this.messages)
      this.messages.show({
        severity: 'error',
        summary: error.name,
        detail: error.message
      })
  }

  async pdfGenerate(color, lectureuuid) {
    this.setState({ pdfgenerate: { message: 'Load data...' } })
    const params = {}
    if (lectureuuid) params.lectureuuid = lectureuuid
    try {
      const response = await axios.get('/lecture/pdfdata', {
        ...this.axiosConfig(),
        params: params
      })
      if (response) {
        if (response.data.error) {
          this.messages.show({
            severity: 'error',
            summary: 'get /app/lecture/pdfdata failed',
            detail: response.data.error
          })
        } else {
          this.setState({
            pdfgenerate: { message: 'Start generating PDF...please wait...' }
          })
          console.log('log pdf generate data', response.data)
          response.data.color = color
          const pdfgen = new PDFGenerator(response.data)
          await pdfgen.initPDF(response.data)
          const mypdf = await pdfgen.createPDF()
          this.setState({
            pdfgenerate: { message: 'PDF generated!', pdf: mypdf }
          })
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  downloadPDF() {
    if (!this.state.pdfgenerate || !this.state.pdfgenerate.pdf) return

    const theblob = new Blob([this.state.pdfgenerate.pdf], {
      type: 'application/pdf'
    })
    fileDownload(theblob, 'lecture.pdf')
    this.setState({ pdfgenerate: null })
  }

  openNotebookWarn(event) {
    confirmDialog({
      message:
        'After starting no removal, change or adding of a background PDF is possible, proceed?',
      header: 'Confirm lecture start',
      icon: 'pi pi-exclamation-triangle',
      accept: this.openNotebook,
      reject: () => {} // do nothing
    })
  }

  async openStudentNotes() {
    console.log('open studentnotes')

    try {
      const response = await axios.get(
        '/lecture/studenttoken',
        this.axiosConfig()
      )
      if (response) {
        if (response.data.error) {
          this.messages.show({
            severity: 'error',
            summary: 'get /app/lecture/studenttoken failed',
            detail: response.data.error
          })
        } else {
          this.messages.show({
            severity: 'info',
            summary: 'Open student notes..',
            detail: 'in new tab!'
          })
          /* console.log("Notes data", response.data);
          console.log("processenv", process.env);
          console.log("URL", process.env.REACT_APP_NOTEPAD_BASE_URL); */

          console.log('debug target url config', cfg.getURL('web'))
          let targeturl = cfg.getURL('web')
          if (targeturl[0] === '/')
            targeturl =
              window.location.protocol +
              '//' +
              window.location.hostname +
              (window.location.port !== '' ? ':' + window.location.port : '') +
              targeturl
          console.log('debug target url', targeturl)

          const newwindow = window.open(
            targeturl /* +"?token="+response.data.token */,
            '_blank'
          )

          if (!newwindow) {
            this.messages.show({
              severity: 'error',
              summary: 'opening new window failed!',
              detail: response.data.error
            })
            console.log('Opening window failed')
          } else {
            // newwindow.failspurpose = "lecture";
            // console.log("token to pass",response.data.token);
            // newwindow.failstoken = response.data.token;

            let postcount = 0
            const intervalId = setInterval(() => {
              newwindow.postMessage(
                { token: response.data.token, purpose: 'notes' },
                targeturl
              )
              if (postcount === 50) window.clearInterval(intervalId) // if it was not loaded after 10 seconds forget about it
              postcount++
            }, 200)
          }
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  async openNotebook() {
    console.log('open notebook')

    try {
      const response = await axios.get(
        '/lecture/notepadtoken',
        this.axiosConfig()
      )
      if (response) {
        if (response.data.error) {
          this.messages.show({
            severity: 'error',
            summary: 'get /app/lecture/notepadtoken failed',
            detail: response.data.error
          })
        } else {
          this.messages.show({
            severity: 'info',
            summary: 'Open notebook..',
            detail: 'in new tab!'
          })
          /* console.log("Notebook data", response.data);
          console.log("processenv", process.env);
          console.log("URL", process.env.REACT_APP_NOTEPAD_BASE_URL); */

          console.log('debug target url config', cfg.getURL('web'))
          let targeturl = cfg.getURL('web')
          if (targeturl[0] === '/')
            targeturl =
              window.location.protocol +
              '//' +
              window.location.hostname +
              (window.location.port !== '' ? ':' + window.location.port : '') +
              targeturl
          console.log('debug target url', targeturl)

          const newwindow = window.open(
            targeturl /* +"?token="+response.data.token */,
            '_blank'
          )

          if (!newwindow) {
            this.messages.show({
              severity: 'error',
              summary: 'opening new window failed!',
              detail: response.data.error
            })
            console.log('Opening window failed')
          } else {
            // newwindow.failspurpose = "lecture";
            // console.log("token to pass",response.data.token);
            // newwindow.failstoken = response.data.token;

            let postcount = 0
            const intervalId = setInterval(() => {
              newwindow.postMessage(
                { token: response.data.token, purpose: 'lecture' },
                targeturl
              )
              if (postcount === 50) window.clearInterval(intervalId) // if it was not loaded after 10 seconds forget about it
              postcount++
            }, 200)
          }
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  async uploadPicture(input) {
    console.log('uploadpicture', input)
    if (input.files && input.files.length > 0) {
      if (this.messages)
        this.messages.show({
          severity: 'info',
          summary: 'File upload started',
          detail: 'We started a fileupload and creating a thumbnail!'
        })
      // ok fine we have now to generate a thumbnail
      try {
        const picture = input.files[0]
        const blob = await fetch(picture.objectURL).then((r) => r.blob())
        const thumbnail = await reduce.toBlob(picture, { max: 100 })

        const data = new FormData()
        data.append('file', blob)
        data.append('filethumbnail', thumbnail)
        data.append('data', JSON.stringify({ filename: picture.name }))

        const response = await axios.post(
          '/lecture/picture',
          data,
          this.axiosConfig()
        )
        if (response) {
          if (response.data.error) {
            this.messages.show({
              severity: 'error',
              summary: 'get /app/lecture/picture failed',
              detail: response.data.error
            })
          } else {
            this.messages.show({
              severity: 'info',
              summary: 'File upload completed',
              detail: 'Picture and thumbnail uploaded successfully completed!'
            })
          }
        }

        /* console.log("uploadpicture picture", picture);
        console.log("uploadpicture thumbnail", thumbnail);

        console.log("picture col", { filename: picture.name, picture: blob, thumbnail: thumbnail }); */

        if (this.pictureupload.current) this.pictureupload.current.clear()
        this.getLectureDetails()
      } catch (error) {
        this.errorMessage(error)
      }
    }
  }

  async uploadBgpdf(input) {
    console.log('uploadbgpdf', input)

    // ok fine we have now to generate a thumbnail
    try {
      let none = true
      const data = new FormData()
      if (input.files && input.files.length > 0) {
        if (this.messages)
          this.messages.show({
            severity: 'info',
            summary: 'File upload started',
            detail: 'We started a PDF upload!'
          })
        const pdf = input.files[0]
        console.log('pdf upload info', pdf)

        const blob = new Blob([pdf], { type: 'application/pdf' }) // await fetch(pdf.objectURL).then(r => r.blob());
        console.log('pdf upload blob', blob)
        data.append('file', blob)
        data.append('data', JSON.stringify({ filename: pdf.name }))
        none = false
      } else {
        data.append('data', JSON.stringify({ none: true }))
      }

      const response = await axios.post(
        '/lecture/bgpdf',
        data,
        this.axiosConfig()
      )
      if (response) {
        if (response.data.error) {
          if (this.messages)
            this.messages.show({
              severity: 'error',
              summary: 'get /app/lecture/bgpdf failed',
              detail: response.data.error
            })
        } else {
          if (!none)
            this.messages.show({
              severity: 'info',
              summary: 'File upload completed',
              detail: 'PDF uploaded successfully completed!'
            })
        }
      }

      if (this.bgpdfupload.current) this.bgpdfupload.current.clear()
      this.getLectureDetails()
    } catch (error) {
      this.errorMessage(error)
    }
  }

  checkTokenRenew() {
    if (!this.tokentimeout) return
    const delay = this.tokentimeout.diff(moment()).valueOf()

    this.setState({ showrenew: delay })
  }

  async renewToken() {
    axios
      .get('/token', this.axiosConfig())
      .catch(
        function (error) {
          console.log('Error', error.toJSON())
          if (this.messages)
            this.messages.show({
              severity: 'error',
              summary: error.name,
              detail: error.message
            })
        }.bind(this)
      )
      .then(
        function (response) {
          if (response) {
            if (response.data.error) {
              if (this.messages)
                this.messages.show({
                  severity: 'error',
                  summary: 'get /app/token failed',
                  detail: response.data.error
                })
            } else {
              console.log('token details', response.data.token)
              // console.log(moment.unix(jwt_decode(response.data.token).exp,"x").format() );
              this.tokentimeout = moment.unix(
                jwt_decode(response.data.token).exp,
                'x'
              )
              this.setState({ token: response.data.token, showrenew: false })
            }
          }
        }.bind(this)
      )
  }

  async doCopy(para) {
    // console.log("post",para);
    try {
      const response = await axios.post(
        '/lecture/copy',
        para,
        this.axiosConfig()
      )
      // console.log("post response", response);
      if (response) {
        if (response.data.error) {
          if (this.messages)
            this.messages.show({
              severity: 'error',
              summary: 'post /app/lecture/copy failed',
              detail: response.data.error
            })
        } else {
          this.getLectureDetails()
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  async patchLectureDetails(patch) {
    // console.log("patch",patch);
    try {
      const response = await axios.patch('/lecture', patch, this.axiosConfig())
      // console.log("patch response", response);
      if (response) {
        if (response.data.error) {
          if (this.messages)
            this.messages.show({
              severity: 'error',
              summary: 'patch /app/lecture failed',
              detail: response.data.error
            })
        } else {
          this.getLectureDetails()
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  async getLectureDetails() {
    try {
      const response = await axios.get('/lecture', this.axiosConfig())
      if (response) {
        if (response.data.error) {
          if (this.messages)
            this.messages.show({
              severity: 'error',
              summary: 'get /app/lecture failed',
              detail: response.data.error
            })
        } else {
          console.log('lecture details', response.data)
          this.setState({ lectdetail: response.data })
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  async getLectures() {
    try {
      const response = await axios.get('/lectures', this.axiosConfig())
      if (response) {
        if (response.data.error) {
          if (this.messages)
            this.messages.show({
              severity: 'error',
              summary: 'get /app/lectures failed',
              detail: response.data.error
            })
        } else {
          console.log('lectures', response.data)
          this.setState({ lectures: response.data })
        }
      }
    } catch (error) {
      this.errorMessage(error)
    }
  }

  changePoll(changes) {
    if (!changes.id) return
    const tochange = { id: changes.id }
    if (changes.name) tochange.name = changes.name
    if (changes.parentid) tochange.parentid = changes.parentid
    if ('multi' in changes) tochange.multi = changes.multi

    this.patchLectureDetails({ polls: tochange })
  }

  deletePoll(changes) {
    if (!changes.id) return
    const tochange = { id: changes.id }
    if (changes.parentid) tochange.parentid = changes.parentid

    this.patchLectureDetails({ removepolls: tochange })
  }

  pollTemplate(node) {
    let changepollid = node.id
    if (node.type === 'add')
      changepollid = Math.random().toString(36).substr(2, 9)
    const changepolltext = () => {
      this.changePoll({
        id: changepollid,
        parentid: node.parentid,
        name: this.state.polledittext[node.id]
      })
      this.setState((state) => {
        const toret = {
          polledittext: state.polledittext,
          ispolledit: state.ispolledit
        }
        toret.polledittext[node.id] = ''
        toret.ispolledit[node.id] = false
        return toret
      })
    }

    const deletepoll = () => {
      this.deletePoll({ id: changepollid, parentid: node.parentid })
      this.setState((state) => {
        const toret = {
          polledittext: state.polledittext,
          ispolledit: state.ispolledit
        }
        toret.polledittext[node.id] = ''
        toret.ispolledit[node.id] = false
        return toret
      })
    }

    const starteditpoll = () => {
      this.setState((state) => {
        const toret = {
          polledittext: state.polledittext,
          ispolledit: state.ispolledit
        }
        toret.polledittext[node.id] = node.name ? node.name : ''
        toret.ispolledit[node.id] = true
        return toret
      })
    }

    switch (node.type) {
      case 'question': {
        return (
          <span className='p-buttonset'>
            {!this.state.ispolledit[node.id] ? (
              <Button
                label={node.name}
                className='p-button-text p-button-secondary'
              ></Button>
            ) : (
              <React.Fragment>
                <InputText
                  value={this.state.polledittext[node.id]}
                  onChange={(e) =>
                    this.setState((state) => {
                      const toret = { polledittext: state.polledittext }
                      toret.polledittext[node.id] = e.target.value
                      return toret
                    })
                  }
                  placeholder='Edit...'
                  className='p-inputtext-sm'
                ></InputText>
                <Button
                  icon='pi pi-save'
                  className='p-button-text p-button-sm'
                  iconPos='right'
                  onClick={changepolltext}
                />
              </React.Fragment>
            )}
            <ToggleButton
              checked={!!node.multi}
              className='p-button-text p-button-sm p-button-outlined'
              onLabel='multiple'
              offLabel='single'
              onChange={(e) =>
                this.changePoll({ id: changepollid, multi: e.value })
              }
            />
            {!this.state.ispolledit[node.id] && (
              <Button
                icon='pi pi-pencil'
                className='p-button-text p-button-sm'
                iconPos='right'
                onClick={starteditpoll}
              />
            )}
            <Button
              icon='pi pi-trash'
              className='p-button-text p-button-sm p-button-danger'
              iconPos='right'
              onClick={deletepoll}
            />
          </span>
        )
      }
      case 'answer': {
        return (
          <span className='p-buttonset'>
            {!this.state.ispolledit[node.id] ? (
              <Button
                label={node.name}
                className='p-button-text p-button-secondary'
              ></Button>
            ) : (
              <React.Fragment>
                <InputText
                  value={this.state.polledittext[node.id]}
                  onChange={(e) =>
                    this.setState((state) => {
                      const toret = { polledittext: state.polledittext }
                      toret.polledittext[node.id] = e.target.value
                      return toret
                    })
                  }
                  placeholder='Edit...'
                  className='p-inputtext-sm'
                ></InputText>
                <Button
                  icon='pi pi-save'
                  className='p-button-text p-button-sm'
                  iconPos='right'
                  onClick={changepolltext}
                />
              </React.Fragment>
            )}
            {!this.state.ispolledit[node.id] && (
              <Button
                icon='pi pi-pencil'
                className='p-button-text p-button-sm'
                iconPos='right'
                onClick={starteditpoll}
              />
            )}
            <Button
              icon='pi pi-trash'
              className='p-button-text p-button-sm p-button-danger'
              iconPos='right'
              onClick={deletepoll}
            />
          </span>
        )
      }
      case 'add': {
        return (
          <div>
            <InputText
              value={this.state.polledittext[node.id]}
              onChange={(e) =>
                this.setState((state) => {
                  const toret = { polledittext: state.polledittext }
                  toret.polledittext[node.id] = e.target.value
                  return toret
                })
              }
              placeholder='Add...'
              className='p-inputtext-sm'
            ></InputText>
            {this.state.polledittext[node.id] &&
              this.state.polledittext[node.id].toString().length > 0 && (
                <Button
                  icon='pi pi-plus'
                  className='p-button-rounded p-button-text'
                  onClick={changepolltext}
                />
              )}
          </div>
        )
      }
      default: {
        return <b>{node.name}</b>
      }
    }
  }

  lectureTemplate(node) {
    switch (node.type) {
      default: {
        return <b>{node.label}</b>
      }
    }
  }

  itemGalleriaTemplate(item) {
    return (
      <img
        src={item.itemImageSrc}
        alt={item.alt}
        style={{ width: '100%', display: 'block' }}
      />
    )
  }

  thumbnailGalleriaTemplate(item) {
    return (
      <img
        src={item.thumbnailImageSrc}
        alt={item.alt}
        style={{ height: '40px', display: 'block' }}
      />
    )
  }

  render() {
    let polldata = []
    const lecturedata = []
    if (this.state.lectures) {
      const lecturebuckets = {}
      const nobucket = []
      this.state.lectures.forEach((el) => {
        let titleadd = ''
        if (el.lms.course_id) {
          if (!lecturebuckets[el.lms.course_id])
            lecturebuckets[el.lms.course_id] = {
              label: 'no name',
              key: el.lms.course_id,
              children: [],
              type: 'folder',
              selectable: false
            }
          if (el.coursetitle)
            lecturebuckets[el.lms.course_id].label = el.coursetitle
          if (el.date) {
            lecturebuckets[el.lms.course_id].label +=
              ' (' + new Date(el.date).getFullYear() + ')'
            titleadd = ' (' + new Date(el.date).toLocaleDateString() + ')'
          }
          lecturebuckets[el.lms.course_id].children.push({
            label: el.title + titleadd,
            key: el.uuid,
            type: 'lecture'
          })
        } else {
          if (el.date)
            titleadd = ' (' + new Date(el.date).toLocaleDateString() + ')'
          nobucket.push({
            label: el.title + titleadd,
            key: el.uuid,
            type: 'lecture'
          })
        }
      })
      //
      for (const item in lecturebuckets) {
        lecturedata.push(lecturebuckets[item])
      }
      for (const item in nobucket) {
        lecturedata.push(item)
      }
    }

    let picts = []

    let displayname = 'loading...'
    let coursename = 'loading...'
    let lecturename = 'loading...'
    let displaynames = 'loading...'

    let joinlecture = false
    let startlecture = false
    let pictures = false
    let pastlectures = false
    let polls = false

    let bgpdfrem = false
    let bgpdfup = true
    let bgpdfname = 'loading...'

    let date = new Date()

    const lectdetail = this.state.lectdetail
    let running = false
    let bgpdfixed = false
    if (lectdetail) {
      if (lectdetail.title) lecturename = lectdetail.title
      if (lectdetail.coursetitle) coursename = lectdetail.coursetitle
      if (lectdetail.ownersdisplaynames)
        displaynames = lectdetail.ownersdisplaynames.join(', ')
      if (lectdetail.running) running = true
      if (lectdetail.pictures) {
        picts = lectdetail.pictures.map((el) => ({
          itemImageSrc: el.url,
          thumbnailImageSrc: el.urlthumb,
          title: el.name,
          id: el.sha
        }))
      }
      if (lectdetail.date) date = new Date(lectdetail.date)
      if (lectdetail.bgpdf) {
        const bgpdf = lectdetail.bgpdf
        if (bgpdf.sha) {
          bgpdfrem = true
          bgpdfname = 'Unknown_filename.pdf'
        }
        if (bgpdf.name) {
          bgpdfrem = true
          bgpdfname = bgpdf.name
        }
        if (bgpdf.url) {
          bgpdfname = (
            <a
              href={bgpdf.url}
              type='application/pdf'
              target='_blank'
              download={bgpdfname}
              rel='noreferrer'
            >
              {bgpdfname}{' '}
            </a>
          )
        }
        if (bgpdf.none) {
          bgpdfrem = false
          bgpdfname = 'None'
        }
        if (bgpdf.fixed) {
          bgpdfup = false
          bgpdfrem = false
          bgpdfixed = true
        }
      }
      if (lectdetail.polls) {
        polldata = lectdetail.polls.map((el) => {
          const toret = {
            id: el.id,
            key: el.id,
            type: 'question',
            name: el.name,
            children: [],
            multi: !!el.multi
          }
          if (el.children) {
            toret.children = el.children.map((el2) => ({
              id: el2.id,
              key: el2.id,
              type: 'answer',
              parentid: el.id,
              name: el2.name
            }))
          }
          toret.children.push({
            id: el.id + 'ADD',
            type: 'add',
            parentid: el.id
          })
          return toret
        })
      }
      polldata.push({ id: 'ADD', type: 'add' })
    }

    if (this.state.token && this.state.decoded_token) {
      displayname = this.state.decoded_token.user.displayname
      // coursename=this.state.decoded_token.course.coursetitle; // may be move to lecture details
      // lecturename=this.state.decoded_token.course.title; // may be move to lecture details
      if (this.state.decoded_token.role.includes('instructor')) {
        startlecture = true
        if (this.state.lectures && this.state.lectures.length > 1)
          pastlectures = true
        polls = true
        pictures = true
      }
      if (this.state.decoded_token.role.includes('audience')) {
        joinlecture = true
      }
    }

    return (
      <React.Fragment>
        <Toast ref={(el) => (this.messages = el)} position='topleft'>
          {' '}
        </Toast>
        <Dialog
          header='Session renewal'
          visible={this.state.showrenew && this.state.showrenew < 60 * 1000}
          closable={false}
          footer={
            this.state.showrenew > 0 ? (
              <Button
                label={'Renew token'}
                className='p-m-2'
                onClick={this.renewToken}
              ></Button>
            ) : null
          }
        >
          <div className='p-grid p-align-center'>
            <div className='p-col-3'>
              <img
                src={failsLogo}
                style={{ width: '120px' }}
                alt='FAILS logo'
              />
            </div>
            <div className='p-col-9'>
              {this.state.showrenew > 0 && (
                <p>
                  {' '}
                  Your session will expire in less than{' '}
                  {(this.state.showrenew / 1000).toFixed(0)} seconds. Do you
                  want to extend the session?
                </p>
              )}
              {this.state.showrenew < 0 && (
                <p> Your session is expired! You have to reload the page!</p>
              )}
            </div>
          </div>
        </Dialog>

        {this.state.pdfgenerate && (
          <Dialog
            header='PDF generation'
            closable={false}
            style={{ width: '30vw' }}
            visible={this.state.pdfgenerate}
            footer={
              this.state.pdfgenerate.pdf ? (
                <Button
                  label='Download'
                  className='p-m-2'
                  onClick={this.downloadPDF}
                ></Button>
              ) : (
                <span> Wait for download to finish..</span>
              )
            }
          >
            <div className='p-grid p-align-center'>
              <div className='p-col-3'>
                <img
                  src={failsLogo}
                  style={{ width: '80px' }}
                  alt='FAILS logo'
                />
              </div>
              <div className='p-col-9'>
                <p>The system is generating PDF. </p>
                <p>Current status is: {this.state.pdfgenerate.message} </p>
              </div>
            </div>
          </Dialog>
        )}
        {!this.state.token && <h2>No valid token!</h2>}
        {!this.state.lectdetail && <h2>Loading... or no token refresh!</h2>}
        {this.state.token && this.state.lectdetail && (
          <div>
            <div className='p-grid p-align-center'>
              <div className='p-col-fixed' style={{ width: '150px' }}>
                <img src={failsLogo} alt='FAILS logo' />
              </div>
              <div className='p-col'>
                <h2>Course: {coursename}</h2>
                <h3>Lecture: {lecturename}</h3>
                <h4>{displaynames}</h4>
              </div>
            </div>
            <h5>Hello {displayname}!</h5>
            <ScrollPanel
              style={{ width: '100%', height: '75vh' }}
              className='appscroll'
            >
              <div className='p-grid'>
                <div className='p-col-12 p-md-6'>
                  <div className='p-grid'>
                    {joinlecture && running && (
                      <div className='p-col-12 p-md-6'>
                        <Card title='Lecture is running!'>
                          <ProgressSpinner
                            style={{ width: '30px', height: '30px' }}
                            strokeWidth='4'
                            fill='#EEEEEE'
                            animationDuration='2s'
                          />
                          <Button
                            icon='pi pi-users'
                            label='Join lecture'
                            className='p-m-2'
                            onClick={this.openStudentNotes}
                          ></Button>
                        </Card>
                      </div>
                    )}
                    {startlecture && (
                      <div className='p-col-12 p-md-6'>
                        <Card title='Start/Join lecture'>
                          <div className='p-d-flex p-flex-column'>
                            <div className='p-mb-2'>
                              Date: &nbsp;
                              <Calendar
                                value={date}
                                onChange={this.onChangeCalendar}
                                showIcon
                              />
                            </div>
                            <div className='p-mb-2'>
                              <Button
                                icon='pi pi-pencil'
                                label='Notebook'
                                className='p-m-2'
                                onClick={
                                  bgpdfixed
                                    ? this.openNotebook
                                    : this.openNotebookWarn
                                }
                              ></Button>{' '}
                              {/*   <Button
                            icon='pi pi-eye'
                            label='Screencapture'
                            className='p-m-2'
                          ></Button> */}
                            </div>
                            <div className='p-mb-2'>
                              <div className='p-grid'>
                                {bgpdfup && (
                                  <div className='p-col-2'>
                                    <FileUpload
                                      mode='basic'
                                      name='bgpdfupload'
                                      ref={this.bgpdfupload}
                                      chooseOptions={{
                                        icon: 'pi pi-fw pi-upload',
                                        className:
                                          'custom-choose-btn p-button-rounded p-button-text',
                                        iconOnly: true
                                      }}
                                      auto
                                      accept='application/pdf'
                                      maxFileSize={20000000}
                                      customUpload={true}
                                      uploadHandler={this.uploadBgpdf}
                                    />
                                  </div>
                                )}
                                <div className='p-col-8'>
                                  PDF Background: {bgpdfname}{' '}
                                </div>{' '}
                                {bgpdfrem && (
                                  <div className='p-col-2'>
                                    <Button
                                      icon='pi pi-times'
                                      className='p-button-rounded p-button-danger p-button-text'
                                      onClick={() => {
                                        this.uploadBgpdf({})
                                      }}
                                    ></Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      </div>
                    )}
                    <div className='p-col-12 p-md-6'>
                      <Card title='Get script'>
                        <Button
                          icon='pi pi-file'
                          label='PDF color'
                          className='p-m-2'
                          onClick={() => this.pdfGenerate(true)}
                        ></Button>
                        &nbsp;
                        <Button
                          icon='pi pi-file'
                          label='PDF sw'
                          className='p-m-2'
                          onClick={() => this.pdfGenerate(false)}
                        ></Button>
                      </Card>
                    </div>

                    {pictures && (
                      <div className='p-col-12 p-md-6'>
                        <Card title='Pictures'>
                          <div className='p-grid'>
                            {picts.length > 0 && (
                              <div className='p-col-12'>
                                <Galleria
                                  value={picts}
                                  item={this.itemGalleriaTemplate}
                                  thumbnail={this.thumbnailGalleriaTemplate}
                                  activeIndex={this.state.pictIndex}
                                  changeItemOnIndicatorHover={true}
                                  onItemChange={(e) =>
                                    this.setState({ pictIndex: e.index })
                                  }
                                ></Galleria>
                              </div>
                            )}

                            <div className='p-col-12 p-md-6'>
                              <FileUpload
                                mode='basic'
                                name='pictureupload'
                                ref={this.pictureupload}
                                chooseOptions={{ icon: 'pi pi-fw pi-upload' }}
                                auto
                                accept='image/png,image/jpeg'
                                maxFileSize={20000000}
                                customUpload={true}
                                uploadHandler={this.uploadPicture}
                                chooseLabel='Upload picture...'
                              />
                            </div>
                          </div>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
                <div className='p-col-12 p-md-6'>
                  <div className='p-grid'>
                    {pastlectures && (
                      <div className='p-col-12'>
                        <Card title='Other lectures'>
                          <Tree
                            value={lecturedata}
                            nodeTemplate={this.lectureTemplate}
                            selectionMode='single'
                            selectionKeys={this.state.selLecture}
                            onSelectionChange={(e) =>
                              this.setState({ selLecture: e.value })
                            }
                          ></Tree>
                          {this.state.selLecture && (
                            <div className='p-grid'>
                              {!bgpdfixed && (
                                <div className='p-col-3'>
                                  <Button
                                    icon='pi pi-copy'
                                    label='Copy'
                                    className='p-m-2'
                                    onClick={() =>
                                      this.doCopy({
                                        fromuuid: this.state.selLecture,
                                        what: 'all'
                                      })
                                    }
                                  ></Button>
                                </div>
                              )}
                              <div className='p-col-3'>
                                <Button
                                  icon='pi pi-images'
                                  label='Get pictures'
                                  className='p-m-2'
                                  onClick={() =>
                                    this.doCopy({
                                      fromuuid: this.state.selLecture,
                                      what: 'pictures'
                                    })
                                  }
                                ></Button>
                              </div>
                              <div className='p-col-3'>
                                <Button
                                  icon='pi pi-tags'
                                  label='Get polls '
                                  className='p-m-2'
                                  onClick={() =>
                                    this.doCopy({
                                      fromuuid: this.state.selLecture,
                                      what: 'polls'
                                    })
                                  }
                                ></Button>
                              </div>
                              <div className='p-col-3'>
                                <Button
                                  icon='pi pi-file'
                                  label='PDF'
                                  className='p-m-2'
                                  onClick={() =>
                                    this.pdfGenerate(
                                      true,
                                      this.state.selLecture
                                    )
                                  }
                                ></Button>
                              </div>{' '}
                            </div>
                          )}
                        </Card>
                      </div>
                    )}
                    {polls && (
                      <div className='p-col-12'>
                        <Card title='Polls'>
                          <Tree
                            value={polldata}
                            nodeTemplate={this.pollTemplate}
                          ></Tree>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className='p-grid p-align-center'>
                <div className='p-col-fixed' style={{ width: '300px' }}>
                  <img
                    src={failsLogoLong}
                    alt='About FAILS'
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => this.copyingop.toggle(e)}
                  />
                </div>
              </div>
              <OverlayPanel ref={(el) => (this.copyingop = el)}>
                <div className='p-grid'>
                  <div className='p-col-3'>
                    <img src={failsLogo} alt='FAILS logo' />
                  </div>
                  <div className='p-col-9'>
                    <h4>
                      <b>FAILS</b> - components <br />
                      (Fancy automated internet lecture system)
                    </h4>
                    Copyright (C) 2015-2017 (original FAILS), <br />
                    2021- (FAILS Components) Marten Richter
                  </div>
                </div>
                FAILS logo by chadkills <br />
                Custom icons by icon_xpert786 <br /> <br />
                Released under GNU Affero General Public License Version 3.{' '}
                <br /> <br />
                Download the source code from{' '}
                <a href='https://github.com/fails-components'>
                  https://github.com/fails-components
                </a>{' '}
                <br /> <br />
                Build upon the shoulders of giants, see{' '}
                <a href='/static/oss'> OSS attribution and licensing.</a>
              </OverlayPanel>
            </ScrollPanel>
          </div>
        )}
      </React.Fragment>
    )
  }
}

export default App
