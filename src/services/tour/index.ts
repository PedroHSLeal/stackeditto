import "driver.js/dist/driver.css";

import { driver } from "driver.js";

const driverTour = driver();

export function highlight(element: Element) {
  driverTour.highlight({
    element,
    popover: {
      title: "Title",
      description: "Description"
    }
  });
}