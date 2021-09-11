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
  Sink,
  DrawObjectGlyph,
  DrawObjectPicture,
  MemContainer,
  DrawArea2,
  Dispatcher
} from '@fails-components/data'
// eslint-disable-next-line no-unused-vars
import {
  PDFDocument,
  StandardFonts,
  rgb,
  /*  pushGraphicsState,
  rectangle,
  clip, */
  popGraphicsState,
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

export class PDFGenerator extends Sink {
  constructor(args) {
    super()

    this.pictures = args.info.usedpictures

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
    this.doc.setTitle(args.info.title)
    this.doc.setSubject(args.info.coursetitle)
    this.doc.setAuthor(args.info.ownersdisplaynames.join(', '))
    this.doc.setCreationDate(new Date(args.info.date))
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

  startPage(ystart, yend) {
    // var page = this.page;
    /* if (this.firstpage) {
            this.firstpage = false;
        } else {
            
        } */

    this.yoffset = ystart

    // console.log("höhe",this.pageheight - this.margins - this.textHeight, this.pageheight);

    this.objects = []
    this.workobj = {}

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

    page.drawText(this.footertext + ', ' + this.pagenumber.toString(), {
      x: this.tmarginsx,
      y: this.tmarginsy,
      font: this.helvetica,
      size: 8,
      color: rgb(0, 0, 0),
      lineHeight: 10,
      opacity: 1.0,
      maxWidth: this.pagewidth - 2 * this.tmarginsx
    })

    this.pagenumber++

    page.pushOperators(
      // unclips
      popGraphicsState()
    )
    this.objects = []
    this.workobj = {}
  }

  finalize(callback) {
    this.doc.end()
    // console.log('finalize called');
  }

  addPicture(time, objnum, curclient, x, y, width, height, uuid) {
    const pictinfo = this.pictures.find((el) => el.sha === uuid)
    // console.log("pictinfo",pictinfo);
    if (pictinfo) {
      const addpict = new DrawObjectPicture(objnum)

      addpict.addPicture(
        x,
        y - this.yoffset,
        width,
        height,
        uuid,
        pictinfo.url,
        pictinfo.mimetype
      )

      this.objects.push(addpict)
    }

    /*
        var pict = this.pictures[uuid];
        if (pict) {
            var filename = null;
            if (pict.mimetype == 'image/png') {
                filename = this.dir + '/' + uuid + '.png'
            } else if (pict.mimetype == 'image/jpeg') {
                filename = this.dir + '/' + uuid + '.jpg'
            }
            if (filename) this.doc.image(filename, x, y, { width: iwidth, height: iheight });
        } */

    // resubmitpath
  }

  startPath(time, objnum, curclient, x, y, type, color, w, pressure) {
    this.workobj[objnum] = new DrawObjectGlyph(objnum)
    this.workobj[objnum].startPath(
      x,
      y - this.yoffset,
      type,
      color,
      w,
      pressure
    )
  }

  addToPath(time, objid, curclient, x, y, pressure) {
    if (this.workobj[objid]) {
      // TODO handle objid
      this.workobj[objid].addToPath(x, y - this.yoffset, pressure)
    }
  }

  finishPath(time, objid, curclient) {
    if (this.workobj[objid]) {
      this.workobj[objid].finishPath()
      this.objects.push(this.workobj[objid])
      delete this.workobj[objid]
    }
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
        const imagedata = await fetch(obj.url).then((res) => res.arrayBuffer())
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
      } else {
        console.log('unknown type', obj.type)
      }
    }
    // no add fake clipping
    page.drawRectangle({
      x: 0,
      y: 0,
      width: this.pagewidth,
      height: this.margins,
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

  scrollBoard(time, x, y) {
    // do ... nothing....
  }

  async createPDF() {
    // ok we start, first we create a container and fill it

    const drawarea = new DrawArea2()
    this.collection.redrawTo(drawarea) // we determine possible positions for page breaks

    // now we create, the pdfs

    const dispatch = new Dispatcher()
    dispatch.addSink(this)

    let pagepos = 0
    let pdfpages = 0
    let pdfpagepos = 0
    if (this.backgroundpdf) {
      pdfpages = this.doc.getPages()
    }

    while (pagepos <= drawarea.glomax) {
      let page
      let pagebreak

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
      await this.processPageDrawings()
      this.endPage()
      pagepos = pagebreak
    }

    return this.doc.save()
  }
}
