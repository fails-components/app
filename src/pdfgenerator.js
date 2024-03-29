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

import {
  Collection,
  DrawObjectContainer,
  MemContainer,
  DrawArea3,
  Dispatcher
} from '@fails-components/data'
import {
  PDFDocument,
  StandardFonts,
  rgb,
  /*  pushGraphicsState,
  rectangle,
  clip, 
  popGraphicsState, */
  PageSizes
} from 'pdf-lib'
import tinycolor from 'tinycolor2'

function base64Toab(base64) {
  const bstr = window.atob(base64)
  const len = bstr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = bstr.charCodeAt(i)
  }
  return bytes.buffer
}

export class PDFGenerator extends DrawObjectContainer {
  constructor(args) {
    super(args)

    this.footertext = args.info.coursetitle + ', ' + args.info.title + ', '
    if (args.info.ownersdisplaynames) {
      this.footertext += args.info.ownersdisplaynames.join(', ')
      this.footertext += ', '
    }
    this.footertext += new Date(args.info.date).toLocaleDateString('de-DE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    this.bw = !args.color
    this.firstpage = true
    this.pagenumber = 1
    // this.setupGeometry();
    this.statusCB = args.statusCB

    console.log('args logger pdf', args)
    if (
      args.info.backgroundpdfuse &&
      args.info.backgroundpdf &&
      args.info.backgroundpdf.url
    ) {
      this.backgroundpdf = args.info.backgroundpdf.url
    }

    this.collection = new Collection(
      (num, dummy) => new MemContainer(num, dummy),
      {}
    )

    // load the board into the collection
    args.boards.forEach((el) => {
      this.collection.replaceStoredData(el.name, base64Toab(el.data)) // what is the data? really base64
    })

    if (args.boardsnotes) {
      this.collectionnotes = new Collection(
        (num, dummy) => new MemContainer(num, dummy),
        {}
      )
      args.boardsnotes.forEach((el) => {
        this.collectionnotes.replaceStoredData(el.name, el.data) // what is the data? really base64
      })
    }
  }

  async initPDF(args) {
    if (!this.backgroundpdf) {
      this.doc = await PDFDocument.create()
    } else {
      const pdfbytes = await fetch(this.backgroundpdf).then((res) =>
        res.arrayBuffer()
      )
      this.doc = await PDFDocument.load(pdfbytes)
    }

    this.helvetica = await this.doc.embedFont(StandardFonts.Helvetica)
    if (args.info) {
      if (args.info.title) this.doc.setTitle(args.info.title)
      if (args.info.coursetitle) this.doc.setSubject(args.info.coursetitle)
      if (args.info.ownersdisplaynames)
        this.doc.setAuthor(args.info.ownersdisplaynames.join(', '))
      if (args.info.date) this.doc.setCreationDate(new Date(args.info.date))
    }
  }

  setupPageGeometry(page, haspdf) {
    if (haspdf) this.margins = 0
    else this.margins = 72
    this.textHeight = 20

    if (haspdf) {
      this.tmarginsx = 72
      this.tmarginsy = 20
    } else {
      this.tmarginsx = this.tmarginsy = 72
    }

    // now setup page properties
    this.pagewidth = page.getWidth()
    this.pageheight = page.getHeight()
    this.geoscale = this.pagewidth - 2 * this.margins // subtract margins
    this.upageheight = this.pageheight - 2 * this.margins
    this.scrollheight =
      (this.pageheight - 2 * this.margins - this.textHeight) / this.geoscale
  }

  getStringHeightLines(string, fontSize, maxWidth) {
    const width = this.helvetica.widthOfTextAtSize(string, fontSize)

    return Math.ceil(maxWidth / width)
  }

  startPage(ystart, yend) {
    // var page = this.page;
    /* if (this.firstpage) {
            this.firstpage = false;
        } else {
            
        } */

    this.yoffset = ystart
    this.yend = yend

    // console.log("höhe",this.pageheight - this.margins - this.textHeight, this.pageheight);

    this.resetDrawing()

    /* doc.translate(this.margins.left, this.margins.top); //margins
        doc.scale(this.geoscale);
        doc.translate(0, -ystart); */

    /* page.pushOperators(
            pushGraphicsState(),
            rectangle(this.margins, this.margins, 1.0*this.geoscale, (yend - ystart)*this.geoscale),
            clip()
        ); */

    // may be use yend for clipping, don't know

    this.drawpath = []
  }

  endPage(ystart, yend) {
    const page = this.page

    const ftext = this.footertext + ', ' + this.pagenumber.toString()
    const maxWidth = this.pagewidth - 2 * this.tmarginsx

    const nlines = this.getStringHeightLines(ftext, 8, maxWidth)

    page.drawText(ftext, {
      x: this.tmarginsx,
      y: this.tmarginsy - nlines * 10,
      font: this.helvetica,
      size: 8,
      color: rgb(0, 0, 0),
      lineHeight: 10,
      opacity: 1.0,
      maxWidth
    })

    this.pagenumber++

    /* page.pushOperators(
      // unclips
      popGraphicsState()
    ) */
    this.objects = []
    this.workobj = {}
  }

  finalize(callback) {
    this.doc.end()
    // console.log('finalize called');
  }

  async processPageDrawings() {
    const page = this.page
    const geoscale = this.geoscale
    for (let i = 0; i < this.objects.length; i++) {
      const obj = this.objects[i]
      if (obj.type === 'glyph') {
        const pathstring = obj.SVGPath()

        let firstpoint = null
        if (obj.pathpoints && obj.pathpoints.length > 0)
          firstpoint = obj.pathpoints[0]

        const sx = firstpoint ? firstpoint.x : 0
        const sy = firstpoint ? firstpoint.y : 0

        const template = '#000000'
        const strcolor = obj.color.toString(16)
        // eslint-disable-next-line new-cap
        let mycolor = new tinycolor(
          template.substring(0, 7 - strcolor.length) + strcolor
        )

        let alpha = 1
        if (obj.gtype === 0) {
          if (mycolor.toHexString() === '#ffffff')
            // eslint-disable-next-line new-cap
            mycolor = new tinycolor('black')
          if (mycolor.isLight()) mycolor.darken(20)
        } else if (obj.gtype === 1) {
          alpha = 0.7 // was 0.3
        } else if (obj.gtype === 2) {
          // eslint-disable-next-line new-cap
          mycolor = new tinycolor('white')
          alpha = 1
        }

        let strokewidth = null
        let strokecolor
        let strokealpha
        if (obj.gtype === 0 && !this.bw) {
          strokewidth = 0.25 * obj.width
          // eslint-disable-next-line new-cap
          const workcolor = new tinycolor(mycolor.toString())
          strokecolor = workcolor.darken(20).toHexString()
          strokealpha = alpha
        }
        if (this.bw && obj.gtype !== 2) {
          if (obj.gtype === 0) {
            mycolor = tinycolor('black')
          } else if (obj.gtype === 1) {
            mycolor = mycolor.greyscale()
            // console.log("grey marker", mycolor);
          }
        }
        // console.log("drawsvg", pathstring,(obj.area.left+sx)/obj.svgscale,(obj.area.top+sy)/obj.svgscale );
        const mc = mycolor.toRgb()
        if (strokewidth) {
          const sc = strokecolor.toRgb()
          page.drawSvgPath(pathstring, {
            x: this.margins + (sx / obj.svgscale) * geoscale,
            y:
              this.margins + this.upageheight + (-sy / obj.svgscale) * geoscale,
            color: rgb(mc.r / 255, mc.g / 255, mc.b / 255),
            opacity: alpha,
            borderOpacity: strokealpha,
            borderWidth: strokewidth / obj.svgscale,
            borderColor: rgb(sc.r / 255, sc.g / 255, sc.b / 255),
            scale: geoscale / obj.svgscale
          })
        } else {
          page.drawSvgPath(pathstring, {
            x: this.margins + (sx / obj.svgscale) * geoscale,
            y:
              this.margins + this.upageheight + (-sy / obj.svgscale) * geoscale,
            color: rgb(mc.r / 255, mc.g / 255, mc.b / 255),
            opacity: alpha,
            scale: geoscale / obj.svgscale
          })
        }
      } else if (obj.type === 'image') {
        try {
          const imagedata = await fetch(obj.url).then((res) =>
            res.arrayBuffer()
          )
          let image
          if (obj.mimetype === 'image/jpeg') {
            image = await this.doc.embedJpg(imagedata)
          } else if (obj.mimetype === 'image/png') {
            image = await this.doc.embedPng(imagedata)
          } else {
            console.log('unsupported mimetype')
          }
          page.drawImage(image, {
            x: this.margins + obj.posx * geoscale,
            y:
              this.margins +
              this.upageheight +
              -obj.posy * geoscale -
              obj.height * geoscale,
            width: obj.width * geoscale,
            height: obj.height * geoscale
          })
        } catch (error) {
          page.drawText('Failure downloading image: ' + obj.url, {
            x: this.margins + obj.posx * geoscale,
            y:
              this.margins +
              this.upageheight +
              -obj.posy * geoscale -
              obj.height * geoscale,
            size: 8,
            color: rgb(0, 0, 0),
            lineHeight: 10,
            opacity: 1.0
          })
          console.log('Fail to download image', error)
        }
      } else if (obj.type === 'form') {
        let bAlpha = ((obj.bColor & 0xff000000) >>> 24) / 255
        const fAlpha = ((obj.fColor & 0xff000000) >>> 24) / 255
        let lw = obj.lw
        // eslint-disable-next-line new-cap
        let bMycolor = new tinycolor({
          r: (obj.bColor & 0xff0000) >>> 16,
          g: (obj.bColor & 0xff00) >>> 8,
          b: (obj.bColor & 0xff) >>> 0
        })
        // eslint-disable-next-line new-cap
        let fMycolor = new tinycolor({
          r: (obj.fColor & 0xff0000) >>> 16,
          g: (obj.fColor & 0xff00) >>> 8,
          b: (obj.fColor & 0xff) >>> 0
        })
        // border threat like a normal line
        if (bMycolor.toHexString() === '#ffffff')
          // eslint-disable-next-line new-cap
          bMycolor = new tinycolor('black')
        if (bMycolor.isLight()) bMycolor.darken(20)
        if (bAlpha === 0 && fMycolor.toHexString() === '#ffffff') {
          bAlpha = 1.0
          lw = 0.25
          // eslint-disable-next-line new-cap
          const workcolor = new tinycolor(fMycolor.toString())
          bMycolor = workcolor.darken(20).toHexString()
          bAlpha = fAlpha
        }
        if (this.bw) {
          if (bAlpha > 0) bMycolor = tinycolor('black')
          fMycolor = fMycolor.greyscale()
        }
        const bMc = bMycolor.toRgb()
        const fMc = fMycolor.toRgb()

        switch (obj.formtype) {
          case 1: // line
            // eslint-disable-next-line no-unreachable
            page.drawLine({
              start: {
                x: this.margins + obj.posx * geoscale,
                y: this.margins + this.upageheight + -obj.posy * geoscale
              },
              end: {
                x: this.margins + (obj.posx + obj.width) * geoscale,
                y:
                  this.margins +
                  this.upageheight -
                  (obj.posy + obj.height) * geoscale
              },
              thickness: lw * geoscale,
              color: rgb(bMc.r / 255, bMc.g / 255, bMc.b / 255),
              opacity: bAlpha
            })
            break
          case 2: // rectangle
            page.drawRectangle({
              x: this.margins + obj.posx * geoscale,
              y:
                this.margins +
                this.upageheight +
                -obj.posy * geoscale -
                obj.height * geoscale,
              width: obj.width * geoscale,
              height: obj.height * geoscale,
              borderWidth: lw * geoscale,
              borderOpacity: bAlpha,
              borderColor: rgb(bMc.r / 255, bMc.g / 255, bMc.b / 255),
              color: rgb(fMc.r / 255, fMc.g / 255, fMc.b / 255),
              opacity: fAlpha
            })
            break
          case 3: // circle
            page.drawCircle({
              x: this.margins + (obj.posx + obj.width * 0.5) * geoscale,
              y:
                this.margins +
                this.upageheight +
                -(obj.posy + obj.height * 0.5) * geoscale,
              size: Math.abs(0.5 * obj.width * geoscale),
              borderWidth: lw * geoscale,
              borderOpacity: bAlpha,
              borderColor: rgb(bMc.r / 255, bMc.g / 255, bMc.b / 255),
              color: rgb(fMc.r / 255, fMc.g / 255, fMc.b / 255),
              opacity: fAlpha
            })
            break
          case 4: // ellipse
            page.drawEllipse({
              x: this.margins + (obj.posx + obj.width * 0.5) * geoscale,
              y:
                this.margins +
                this.upageheight +
                -(obj.posy + obj.height * 0.5) * geoscale,
              xScale: Math.abs(0.5 * obj.width * geoscale),
              yScale: Math.abs(0.5 * obj.height * geoscale),
              borderWidth: lw * geoscale,
              borderOpacity: bAlpha,
              borderColor: rgb(bMc.r / 255, bMc.g / 255, bMc.b / 255),
              color: rgb(fMc.r / 255, fMc.g / 255, fMc.b / 255),
              opacity: fAlpha
            })
            break

          default:
            console.log('unknown form type', obj.formtype)
        }
      } else {
        console.log('unknown type', obj.type)
      }
    }
    if (!this.backgroundpdf) {
      // now add fake clipping, if it is not a background pdf
      page.drawRectangle({
        x: 0,
        y: 0,
        width: this.pagewidth,
        height:
          this.margins +
          this.textHeight +
          Math.max(
            0,
            geoscale * (-this.yend + this.yoffset + this.scrollheight)
          ), // white out the line break!
        color: rgb(1, 1, 1)
      })
      page.drawRectangle({
        x: 0,
        y: this.pageheight - this.margins,
        width: this.pagewidth,
        height: this.margins,
        color: rgb(1, 1, 1)
      })

      page.drawRectangle({
        x: 0,
        y: 0,
        width: this.margins,
        height: this.pageheight,
        color: rgb(1, 1, 1)
      })
      page.drawRectangle({
        x: this.pagewidth - this.margins,
        y: 0,
        width: this.margins,
        height: this.pageheight,
        color: rgb(1, 1, 1)
      })
    }
  }

  async createPDF() {
    // ok we start, first we create a container and fill it

    const drawarea = new DrawArea3()
    this.collection.redrawTo(drawarea) // we determine possible positions for page breaks
    drawarea.calculateWeights()
    let drawareanotes
    if (this.collectionnotes) {
      drawareanotes = new DrawArea3()
      this.collectionnotes.redrawTo(drawareanotes)
    }
    // now we create, the pdfs

    const dispatch = new Dispatcher()
    dispatch.addSink(this)

    let pagepos = 0
    let pdfpages = 0
    let pdfpagepos = 0
    if (this.backgroundpdf) {
      pdfpages = this.doc.getPages()
    }
    let glomaxnotes = 0
    if (drawareanotes) {
      glomaxnotes = drawareanotes.glomax
    }
    let pagenum = 1

    while (pagepos <= Math.max(drawarea.glomax, glomaxnotes)) {
      let page
      let pagebreak
      if (this.statusCB) {
        console.log('Status cb', pagenum)
        this.statusCB(pagenum)
      }

      if (!this.backgroundpdf || pdfpagepos >= pdfpages.length) {
        page = this.page = this.doc.addPage(PageSizes.A4)
        this.setupPageGeometry(page, false)
        pagebreak = drawarea.findPagebreak(
          pagepos + 0.75 * this.scrollheight,
          pagepos + this.scrollheight
        )
        this.startPage(pagepos, pagebreak) // start the page
        console.log('Add PDF page', pagepos, pagebreak, this.scrollheight)
      } else {
        page = this.page = pdfpages[pdfpagepos]
        this.setupPageGeometry(page, true)

        pagebreak = pagepos + page.getHeight() / page.getWidth()
        this.startPage(pagepos, pagebreak) // start the page
        pdfpagepos++
        console.log('Modify PDF page', pagepos, pagebreak, this.scrollheight)
      }

      this.collection.redrawTo(
        dispatch,
        Math.floor(pagepos),
        Math.ceil(pagebreak)
      )
      if (this.collectionnotes) {
        this.collectionnotes.redrawTo(
          dispatch,
          Math.floor(pagepos),
          Math.ceil(pagebreak)
        )
      }
      await this.processPageDrawings()
      this.endPage()
      pagepos = pagebreak
      pagenum++
    }

    return this.doc.save()
  }
}
