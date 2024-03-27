import { useRef, useCallback } from "react";
import html2canvas from "html2canvas";

import jsPDF from "jspdf";
import Converter from "./converter";
import { Options, TargetElementFinder, UsePDFResult } from "./types";
import { buildConvertOptions } from "./utils";
import { MM_TO_PX } from "./constants";
export { Resolution, Margin } from "./constants";
export type { Options };

const getTargetElement = (
  targetRefOrFunction: TargetElementFinder
): HTMLElement | null | undefined => {
  if (typeof targetRefOrFunction === "function") {
    return targetRefOrFunction();
  }
  return targetRefOrFunction?.current;
};

export const usePDF = (usePDFoptions?: Options): UsePDFResult => {
  const targetRef = useRef();
  const toPDF = useCallback(
    (toPDFoptions?: Options): Promise<InstanceType<typeof jsPDF>> => {
      return generatePDF(targetRef, usePDFoptions ?? toPDFoptions);
    },
    [targetRef, usePDFoptions]
  );
  return { targetRef, toPDF };
};

const generatePDF = async (
  targetRefOrFunction: TargetElementFinder,
  customOptions?: Options
): Promise<InstanceType<typeof jsPDF>> => {
  const options = buildConvertOptions(customOptions);
  const targetElement = getTargetElement(targetRefOrFunction);
  if (!targetElement) {
    throw new Error("Unable to get the target element");
  }

  let pdf: InstanceType<typeof jsPDF> = undefined;
  if (
    customOptions?.render?.type === "by_page" &&
    customOptions?.render?.pageSelector
  ) {
    // get HTMLElements by page selector

    const pages = targetElement.querySelectorAll(
      customOptions?.render?.pageSelector,
    );

    // console.log('pages', pages)
    for (let index = 0; index < pages.length; index++) {
      const canvas = await html2canvas(pages[index] as HTMLElement, {
        useCORS: options.canvas.useCORS,
        logging: options.canvas.logging,
        scale: options.resolution,
        ...options.overrides?.canvas,
      });
      const converter = new Converter(canvas, options);
      // pdf.addPage()
      // pdf.addImage(page.output('datauristring'), 'JPEG', 0, 0, 210, 297)
      const pageNumber = index + 1;
      if (!pdf) {
        const page = converter.convert();
        pdf = page;
        pdf.setPage(pageNumber);
      } else {
        pdf.addPage();
        pdf.setPage(pageNumber);
        const canvasPage = converter.createCanvasPage(1);
        const pageImageDataURL = canvasPage.toDataURL(
          converter.options.canvas?.mimeType,
          converter.options.canvas?.qualityRatio,
        );
        pdf.addImage({
          imageData: pageImageDataURL,
          width:
            canvasPage.width /
            (converter.getScale() *
              MM_TO_PX *
              converter.getHorizontalFitFactor()),
          height:
            canvasPage.height /
            (converter.getScale() *
              MM_TO_PX *
              converter.getHorizontalFitFactor()),
          x: converter.getMarginLeftMM(),
          y: converter.getMarginTopMM(),
        });
      }
    }
  } else {
    const canvas = await html2canvas(targetElement, {
      useCORS: options.canvas.useCORS,
      logging: options.canvas.logging,
      scale: options.resolution,
      ...options.overrides?.canvas,
    });
    const converter = new Converter(canvas, options);
    pdf = converter.convert();
  }

  switch (options.method) {
    case "build":
      return pdf;
    case "open": {
      window.open(pdf.output("bloburl"), "_blank");
      return pdf;
    }
    case "save":
    default: {
      const pdfFilename = options.filename ?? `${new Date().getTime()}.pdf`;
      await pdf.save(pdfFilename, { returnPromise: true });
      return pdf;
    }
  }
};

export default generatePDF;
