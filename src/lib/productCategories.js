// GENERATED from server/src/utils/productCategories.js by server/scripts/sync-client-categories.mjs. Do not edit by hand.
export const CORE_CATEGORIES = ["panel","inverter","battery"];
export const CATEGORY_GROUPS = ["Core system","Power & control","Mounting & wiring","Protection & safety","Monitoring & metering","Complete products"];
export const PRODUCT_CATEGORIES = ["panel","inverter","battery","controller","mounting","cable","connector","protection","surge_protection","distribution","earthing","accessory","meter","monitoring","transfer_switch","energy_management","portable_power","generator","pump","streetlight","lighting","kit"];
export const CATEGORY_SPECS = {
  "panel": {
    "label": "Solar panel",
    "plural": "Solar panels",
    "group": "Core system",
    "rating": {
      "mode": "required",
      "label": "Power per panel (watts)",
      "unit": "W",
      "min": 50,
      "max": 1000,
      "integer": true
    },
    "voltage": "none"
  },
  "inverter": {
    "label": "Inverter",
    "plural": "Inverters",
    "group": "Core system",
    "rating": {
      "mode": "required",
      "label": "Inverter size (kVA)",
      "unit": "kVA",
      "min": 0.3,
      "max": 50,
      "integer": false
    },
    "voltage": "required"
  },
  "battery": {
    "label": "Battery",
    "plural": "Batteries",
    "group": "Core system",
    "rating": {
      "mode": "required",
      "label": "Usable storage per unit (kWh)",
      "unit": "kWh",
      "min": 0.5,
      "max": 200,
      "integer": false
    },
    "voltage": "required"
  },
  "controller": {
    "label": "Charge controller",
    "plural": "Charge controllers",
    "group": "Power & control",
    "rating": {
      "mode": "required",
      "label": "Rated charging current (A)",
      "unit": "A",
      "min": 1,
      "max": 200,
      "integer": true
    },
    "voltage": "optional"
  },
  "portable_power": {
    "label": "Portable power station",
    "plural": "Portable power stations",
    "group": "Power & control",
    "rating": {
      "mode": "required",
      "label": "Usable storage (kWh)",
      "unit": "kWh",
      "min": 0.1,
      "max": 50,
      "integer": false
    },
    "voltage": "optional"
  },
  "generator": {
    "label": "Generator",
    "plural": "Generators",
    "group": "Power & control",
    "rating": {
      "mode": "required",
      "label": "Output (kVA)",
      "unit": "kVA",
      "min": 0.5,
      "max": 2000,
      "integer": false
    },
    "voltage": "none"
  },
  "transfer_switch": {
    "label": "Transfer switch",
    "plural": "Transfer switches",
    "group": "Power & control",
    "rating": {
      "mode": "optional",
      "label": "Rated current (A)",
      "unit": "A",
      "min": 1,
      "max": 1000,
      "integer": true
    },
    "voltage": "none"
  },
  "energy_management": {
    "label": "Energy management",
    "plural": "Energy management",
    "group": "Power & control",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "mounting": {
    "label": "Mounting & racking",
    "plural": "Mounting & racking",
    "group": "Mounting & wiring",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "cable": {
    "label": "Solar cable",
    "plural": "Solar cables",
    "group": "Mounting & wiring",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "connector": {
    "label": "Connector",
    "plural": "Connectors",
    "group": "Mounting & wiring",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "distribution": {
    "label": "Combiner / distribution box",
    "plural": "Combiner & distribution boxes",
    "group": "Mounting & wiring",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "protection": {
    "label": "Breaker / fuse",
    "plural": "Breakers & fuses",
    "group": "Protection & safety",
    "rating": {
      "mode": "optional",
      "label": "Rated current (A)",
      "unit": "A",
      "min": 1,
      "max": 1000,
      "integer": true
    },
    "voltage": "none"
  },
  "surge_protection": {
    "label": "Surge protection",
    "plural": "Surge protection",
    "group": "Protection & safety",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "earthing": {
    "label": "Earthing & lightning",
    "plural": "Earthing & lightning",
    "group": "Protection & safety",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "meter": {
    "label": "Energy meter",
    "plural": "Energy meters",
    "group": "Monitoring & metering",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "monitoring": {
    "label": "Monitoring device",
    "plural": "Monitoring devices",
    "group": "Monitoring & metering",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  },
  "pump": {
    "label": "Solar pump",
    "plural": "Solar pumps",
    "group": "Complete products",
    "rating": {
      "mode": "required",
      "label": "Pump power (watts)",
      "unit": "W",
      "min": 50,
      "max": 50000,
      "integer": true
    },
    "voltage": "none"
  },
  "streetlight": {
    "label": "Solar streetlight",
    "plural": "Solar streetlights",
    "group": "Complete products",
    "rating": {
      "mode": "required",
      "label": "Light power (watts)",
      "unit": "W",
      "min": 5,
      "max": 500,
      "integer": true
    },
    "voltage": "none"
  },
  "lighting": {
    "label": "Solar lighting",
    "plural": "Solar lighting",
    "group": "Complete products",
    "rating": {
      "mode": "required",
      "label": "Light power (watts)",
      "unit": "W",
      "min": 1,
      "max": 1000,
      "integer": true
    },
    "voltage": "none"
  },
  "kit": {
    "label": "Solar kit",
    "plural": "Solar kits",
    "group": "Complete products",
    "rating": {
      "mode": "required",
      "label": "System size (kWp)",
      "unit": "kWp",
      "min": 0.05,
      "max": 1000,
      "integer": false
    },
    "voltage": "none"
  },
  "accessory": {
    "label": "Accessory",
    "plural": "Accessories",
    "group": "Complete products",
    "rating": {
      "mode": "none"
    },
    "voltage": "none"
  }
};
