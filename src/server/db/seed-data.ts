import {
  CATEGORY_DEFINITIONS,
  CATEGORY_HANDLES,
  type CategoryHandle,
} from "@/domain/commerce/catalog";
import type { PolicyKey } from "@/domain/commerce/policies";

/**
 * Synthetic DEMO catalog for the fictional Mero & Moss store.
 * All products, prices and stock levels are invented demo data.
 * Prices are integer USD cents.
 */

export interface SeedCategory {
  handle: CategoryHandle;
  title: string;
  description: string;
}

export interface SeedVariant {
  sku: string;
  options: Record<string, string>;
  priceMinor: number;
  inventory: number;
}

export interface SeedProduct {
  handle: string;
  title: string;
  category: CategoryHandle;
  summary: string;
  description: string;
  materials: string;
  care: string;
  tags: string[];
  featured?: boolean;
  swatch: string;
  /** Days before the seed reference date the product was added (drives "newest"). */
  addedDaysAgo: number;
  variants: SeedVariant[];
}

export interface SeedPolicy {
  key: PolicyKey;
  title: string;
  summary: string;
  body: string;
}

export const SEED_REFERENCE_DATE = "2026-11-01T09:00:00.000Z";
export const SEED_CURRENCY = "USD" as const;

export const SEED_CATEGORIES: SeedCategory[] = CATEGORY_HANDLES.map((handle) => ({
  handle,
  ...CATEGORY_DEFINITIONS[handle],
}));

export const SEED_PRODUCTS: SeedProduct[] = [
  // Home Organization
  {
    handle: "woven-seagrass-basket",
    title: "Woven Seagrass Basket",
    category: "home-organization",
    summary: "A sturdy hand-woven basket for throws, toys or laundry.",
    description:
      "Tightly woven from natural seagrass around a steel-wire frame, this basket keeps its shape when full. Two woven handles make it easy to move from room to room.",
    materials: "Natural seagrass, powder-coated steel frame",
    care: "Wipe with a dry cloth. Keep away from prolonged moisture.",
    tags: ["natural-fiber", "storage", "living-room"],
    featured: true,
    swatch: "#c8b48a",
    addedDaysAgo: 120,
    variants: [
      { sku: "MM-HO-SGB-S", options: { Size: "Small" }, priceMinor: 3400, inventory: 24 },
      { sku: "MM-HO-SGB-M", options: { Size: "Medium" }, priceMinor: 4200, inventory: 18 },
      { sku: "MM-HO-SGB-L", options: { Size: "Large" }, priceMinor: 5400, inventory: 4 },
    ],
  },
  {
    handle: "linen-storage-bin",
    title: "Linen Storage Bin",
    category: "home-organization",
    summary: "Soft-sided linen bin that folds flat when not in use.",
    description:
      "A washed-linen exterior over a rigid recycled-board insert. Fits standard shelving cubes and folds flat for storage.",
    materials: "Washed linen, recycled paperboard insert",
    care: "Spot clean with mild soap. Remove insert before cleaning.",
    tags: ["linen", "storage", "shelving"],
    swatch: "#d9cdb8",
    addedDaysAgo: 95,
    variants: [
      { sku: "MM-HO-LSB-OAT", options: { Color: "Oat" }, priceMinor: 2800, inventory: 30 },
      { sku: "MM-HO-LSB-CHR", options: { Color: "Charcoal" }, priceMinor: 2800, inventory: 12 },
      { sku: "MM-HO-LSB-MOS", options: { Color: "Moss" }, priceMinor: 2800, inventory: 0 },
    ],
  },
  {
    handle: "oak-wall-hook-rail",
    title: "Oak Wall Hook Rail",
    category: "home-organization",
    summary: "Solid oak rail with turned pegs for coats, bags and hats.",
    description:
      "Cut from FSC-certified solid oak with turned pegs set at a gentle upward angle. Mounting hardware is included.",
    materials: "FSC-certified solid oak, steel mounting screws",
    care: "Dust regularly. Re-oil once a year with a food-safe wood oil.",
    tags: ["oak", "entryway", "wall"],
    swatch: "#b08a5a",
    addedDaysAgo: 60,
    variants: [
      { sku: "MM-HO-OHR-3", options: { Hooks: "3 hooks" }, priceMinor: 3800, inventory: 15 },
      { sku: "MM-HO-OHR-5", options: { Hooks: "5 hooks" }, priceMinor: 5200, inventory: 9 },
    ],
  },
  {
    handle: "stoneware-catchall-tray",
    title: "Stoneware Catch-All Tray",
    category: "home-organization",
    summary: "A shallow glazed tray for keys, rings and pocket things.",
    description:
      "A small stoneware tray with a satin glaze and an unglazed foot. It sits neatly on a console table or a bedside shelf.",
    materials: "Glazed stoneware",
    care: "Dishwasher safe.",
    tags: ["stoneware", "entryway", "bedroom"],
    swatch: "#e8e2d6",
    addedDaysAgo: 40,
    variants: [
      { sku: "MM-HO-SCT-CHK", options: { Color: "Chalk" }, priceMinor: 2400, inventory: 22 },
      { sku: "MM-HO-SCT-CLY", options: { Color: "Clay" }, priceMinor: 2400, inventory: 3 },
    ],
  },
  {
    handle: "canvas-laundry-tote",
    title: "Canvas Laundry Tote",
    category: "home-organization",
    summary: "Heavy cotton canvas tote with leather carry handles.",
    description:
      "A tall, structured tote in 18 oz cotton canvas that carries a full load of laundry to the machine and back.",
    materials: "18 oz cotton canvas, vegetable-tanned leather handles",
    care: "Spot clean. Do not machine wash the leather handles.",
    tags: ["canvas", "laundry"],
    swatch: "#cfc3a8",
    addedDaysAgo: 150,
    variants: [
      { sku: "MM-HO-CLT-NAT", options: { Color: "Natural" }, priceMinor: 4600, inventory: 11 },
      { sku: "MM-HO-CLT-CHR", options: { Color: "Charcoal" }, priceMinor: 4600, inventory: 7 },
    ],
  },
  {
    handle: "cedar-drawer-blocks",
    title: "Cedar Drawer Blocks (Set of 8)",
    category: "home-organization",
    summary: "Aromatic cedar blocks that keep drawers and closets fresh.",
    description:
      "Untreated red cedar blocks for drawers and closets. Lightly sand the surface to refresh the scent.",
    materials: "Untreated red cedar",
    care: "Sand lightly every few months to refresh the scent.",
    tags: ["cedar", "closet"],
    swatch: "#a8603c",
    addedDaysAgo: 200,
    variants: [{ sku: "MM-HO-CDB-8", options: {}, priceMinor: 1800, inventory: 40 }],
  },
  {
    handle: "felt-shelf-dividers",
    title: "Felt Shelf Dividers (Set of 4)",
    category: "home-organization",
    summary: "Clip-on wool felt dividers that keep stacks upright.",
    description:
      "Thick wool-blend felt panels that clip onto shelves up to 1 inch deep to keep sweaters and linens in tidy stacks.",
    materials: "Wool-blend felt, steel clip",
    care: "Brush off dust. Spot clean with cool water.",
    tags: ["felt", "closet", "shelving"],
    swatch: "#9c9a94",
    addedDaysAgo: 30,
    variants: [
      { sku: "MM-HO-FSD-GRY", options: { Color: "Grey" }, priceMinor: 2600, inventory: 19 },
      { sku: "MM-HO-FSD-OAT", options: { Color: "Oat" }, priceMinor: 2600, inventory: 14 },
    ],
  },

  // Table & Kitchen
  {
    handle: "stoneware-dinner-plate",
    title: "Stoneware Dinner Plate",
    category: "table-and-kitchen",
    summary: "An everyday 10.5 inch plate with a soft satin glaze.",
    description:
      "Thrown in a small batch and finished in a satin glaze with a speckled clay body. Generous enough for dinner, light enough for every day.",
    materials: "Stoneware with satin glaze",
    care: "Dishwasher and microwave safe.",
    tags: ["stoneware", "dinnerware"],
    featured: true,
    swatch: "#e9e4da",
    addedDaysAgo: 80,
    variants: [
      { sku: "MM-TK-SDP-CHK", options: { Color: "Chalk" }, priceMinor: 2200, inventory: 48 },
      { sku: "MM-TK-SDP-MOS", options: { Color: "Moss" }, priceMinor: 2200, inventory: 26 },
      { sku: "MM-TK-SDP-CLY", options: { Color: "Clay" }, priceMinor: 2200, inventory: 5 },
    ],
  },
  {
    handle: "linen-napkins-set",
    title: "Linen Napkins (Set of 4)",
    category: "table-and-kitchen",
    summary: "Stonewashed linen napkins that soften with every wash.",
    description:
      "Four 18 x 18 inch napkins in stonewashed European flax linen with mitered corners.",
    materials: "100% European flax linen",
    care: "Machine wash warm, tumble dry low.",
    tags: ["linen", "table"],
    swatch: "#b9c0a3",
    addedDaysAgo: 110,
    variants: [
      { sku: "MM-TK-LNS-OAT", options: { Color: "Oat" }, priceMinor: 3600, inventory: 20 },
      { sku: "MM-TK-LNS-SGE", options: { Color: "Sage" }, priceMinor: 3600, inventory: 16 },
      { sku: "MM-TK-LNS-TRC", options: { Color: "Terracotta" }, priceMinor: 3600, inventory: 8 },
    ],
  },
  {
    handle: "olive-wood-serving-board",
    title: "Olive Wood Serving Board",
    category: "table-and-kitchen",
    summary: "A single-piece olive wood board for bread, cheese and fruit.",
    description:
      "Each board is cut from one piece of olive wood, so grain and color vary from board to board. A carved handle makes it easy to bring to the table.",
    materials: "Solid olive wood",
    care: "Hand wash only. Oil occasionally with a food-safe oil.",
    tags: ["wood", "serving"],
    featured: true,
    swatch: "#9a7b4f",
    addedDaysAgo: 55,
    variants: [
      { sku: "MM-TK-OWB-S", options: { Size: "Small" }, priceMinor: 4400, inventory: 13 },
      { sku: "MM-TK-OWB-L", options: { Size: "Large" }, priceMinor: 6800, inventory: 6 },
    ],
  },
  {
    handle: "hand-thrown-mug",
    title: "Hand-Thrown Mug",
    category: "table-and-kitchen",
    summary: "A 12 oz mug with a thumb rest and a wide, steady base.",
    description:
      "Thrown on the wheel and glazed inside and out. Each mug holds about 12 oz and has a thumb rest on the handle.",
    materials: "Glazed stoneware",
    care: "Dishwasher and microwave safe.",
    tags: ["stoneware", "coffee"],
    swatch: "#7d8a63",
    addedDaysAgo: 20,
    variants: [
      { sku: "MM-TK-HTM-CHK", options: { Color: "Chalk" }, priceMinor: 2600, inventory: 35 },
      { sku: "MM-TK-HTM-MOS", options: { Color: "Moss" }, priceMinor: 2600, inventory: 0 },
      { sku: "MM-TK-HTM-CLY", options: { Color: "Clay" }, priceMinor: 2600, inventory: 17 },
    ],
  },
  {
    handle: "glass-pantry-jar",
    title: "Glass Pantry Jar",
    category: "table-and-kitchen",
    summary: "Borosilicate jar with an airtight bamboo lid.",
    description:
      "Heat-resistant borosilicate glass with a silicone-sealed bamboo lid for grains, pasta and coffee beans.",
    materials: "Borosilicate glass, bamboo, food-grade silicone",
    care: "Glass is dishwasher safe. Hand wash the lid.",
    tags: ["glass", "pantry"],
    swatch: "#cfd8d2",
    addedDaysAgo: 140,
    variants: [
      { sku: "MM-TK-GPJ-05", options: { Size: "0.5 L" }, priceMinor: 1400, inventory: 50 },
      { sku: "MM-TK-GPJ-10", options: { Size: "1 L" }, priceMinor: 1800, inventory: 42 },
      { sku: "MM-TK-GPJ-20", options: { Size: "2 L" }, priceMinor: 2400, inventory: 21 },
    ],
  },
  {
    handle: "cast-iron-trivet",
    title: "Cast Iron Trivet",
    category: "table-and-kitchen",
    summary: "A heavy round trivet that protects the table from hot pans.",
    description:
      "Sand-cast iron with a pre-seasoned finish and felt feet to protect wooden tables.",
    materials: "Cast iron, wool felt feet",
    care: "Wipe clean and dry immediately. Do not soak.",
    tags: ["cast-iron", "table"],
    swatch: "#3e3b37",
    addedDaysAgo: 170,
    variants: [{ sku: "MM-TK-CIT-1", options: {}, priceMinor: 2900, inventory: 2 }],
  },
  {
    handle: "waffle-tea-towels",
    title: "Waffle Tea Towels (Set of 2)",
    category: "table-and-kitchen",
    summary: "Absorbent cotton waffle-weave towels for the kitchen.",
    description:
      "A deep waffle weave in long-staple cotton that dries glassware without lint. Hanging loop on one corner.",
    materials: "100% long-staple cotton",
    care: "Machine wash warm, tumble dry.",
    tags: ["cotton", "kitchen"],
    swatch: "#ddd3c1",
    addedDaysAgo: 75,
    variants: [
      { sku: "MM-TK-WTT-OAT", options: { Color: "Oat" }, priceMinor: 2400, inventory: 28 },
      { sku: "MM-TK-WTT-CHR", options: { Color: "Charcoal" }, priceMinor: 2400, inventory: 19 },
    ],
  },

  // Workspace
  {
    handle: "walnut-desk-organizer",
    title: "Walnut Desk Organizer",
    category: "workspace",
    summary: "A solid walnut caddy with slots for pens, cards and a phone.",
    description:
      "Milled from one block of American black walnut with a slot for a phone, a pen well and a shallow tray for clips and cards.",
    materials: "Solid American black walnut, natural oil finish",
    care: "Dust with a soft cloth. Re-oil occasionally.",
    tags: ["walnut", "desk"],
    featured: true,
    swatch: "#5b4232",
    addedDaysAgo: 45,
    variants: [{ sku: "MM-WS-WDO-1", options: {}, priceMinor: 6400, inventory: 10 }],
  },
  {
    handle: "felt-desk-mat",
    title: "Felt Desk Mat",
    category: "workspace",
    summary: "A wool felt mat that quiets the keyboard and warms the desk.",
    description:
      "Dense 4 mm merino wool felt with a non-slip cork underside. Protects the desk surface and softens keyboard noise.",
    materials: "Merino wool felt, natural cork backing",
    care: "Vacuum or brush. Spot clean with cool water.",
    tags: ["felt", "desk"],
    swatch: "#5a5a58",
    addedDaysAgo: 65,
    variants: [
      {
        sku: "MM-WS-FDM-CHR-M",
        options: { Color: "Charcoal", Size: "Medium" },
        priceMinor: 4800,
        inventory: 14,
      },
      {
        sku: "MM-WS-FDM-CHR-L",
        options: { Color: "Charcoal", Size: "Large" },
        priceMinor: 5800,
        inventory: 9,
      },
      {
        sku: "MM-WS-FDM-OAT-M",
        options: { Color: "Oat", Size: "Medium" },
        priceMinor: 4800,
        inventory: 6,
      },
      {
        sku: "MM-WS-FDM-OAT-L",
        options: { Color: "Oat", Size: "Large" },
        priceMinor: 5800,
        inventory: 0,
      },
    ],
  },
  {
    handle: "brass-task-lamp",
    title: "Brass Task Lamp",
    category: "workspace",
    summary: "An adjustable task lamp with a weighted base and warm LED.",
    description:
      "An articulated arm and a weighted base put the light where you need it. Ships with a warm 2700K LED bulb.",
    materials: "Brass or powder-coated steel, cast iron base",
    care: "Wipe with a dry cloth. Unplug before cleaning.",
    tags: ["lighting", "desk"],
    swatch: "#b8924a",
    addedDaysAgo: 15,
    variants: [
      {
        sku: "MM-WS-BTL-BRS",
        options: { Finish: "Brushed Brass" },
        priceMinor: 14800,
        inventory: 7,
      },
      {
        sku: "MM-WS-BTL-BLK",
        options: { Finish: "Matte Black" },
        priceMinor: 14800,
        inventory: 12,
      },
    ],
  },
  {
    handle: "linen-bound-notebook",
    title: "Linen-Bound Notebook",
    category: "workspace",
    summary: "A lay-flat A5 notebook with 192 pages of 100 gsm paper.",
    description:
      "Thread-sewn binding lets the notebook lie flat. The linen cover wears in rather than out.",
    materials: "Linen cloth cover, 100 gsm acid-free paper",
    care: "Keep dry.",
    tags: ["paper", "desk"],
    swatch: "#8c9a7a",
    addedDaysAgo: 100,
    variants: [
      { sku: "MM-WS-LBN-DOT", options: { Ruling: "Dot grid" }, priceMinor: 2200, inventory: 33 },
      { sku: "MM-WS-LBN-LIN", options: { Ruling: "Lined" }, priceMinor: 2200, inventory: 25 },
      { sku: "MM-WS-LBN-BLK", options: { Ruling: "Blank" }, priceMinor: 2200, inventory: 18 },
    ],
  },
  {
    handle: "ceramic-pen-cup",
    title: "Ceramic Pen Cup",
    category: "workspace",
    summary: "A simple glazed cup for pens, brushes and scissors.",
    description: "A weighty stoneware cup with a glazed interior that will not tip when full.",
    materials: "Glazed stoneware",
    care: "Wipe clean.",
    tags: ["stoneware", "desk"],
    swatch: "#e6e0d3",
    addedDaysAgo: 130,
    variants: [
      { sku: "MM-WS-CPC-CHK", options: { Color: "Chalk" }, priceMinor: 1800, inventory: 27 },
      { sku: "MM-WS-CPC-MOS", options: { Color: "Moss" }, priceMinor: 1800, inventory: 15 },
    ],
  },
  {
    handle: "oak-monitor-stand",
    title: "Oak Monitor Stand",
    category: "workspace",
    summary: "Raises the screen to eye level and frees space underneath.",
    description:
      "A solid oak shelf on steel legs that lifts a monitor or laptop about 4 inches and leaves room for a keyboard underneath.",
    materials: "FSC-certified solid oak, powder-coated steel legs",
    care: "Dust regularly. Avoid standing water.",
    tags: ["oak", "desk", "ergonomics"],
    swatch: "#c19a6b",
    addedDaysAgo: 35,
    variants: [{ sku: "MM-WS-OMS-1", options: {}, priceMinor: 9600, inventory: 8 }],
  },
  {
    handle: "leather-cable-wraps",
    title: "Leather Cable Wraps (Set of 5)",
    category: "workspace",
    summary: "Snap-close leather straps that tame chargers and cords.",
    description:
      "Vegetable-tanned leather straps with brass snaps for coiling chargers, earphones and spare cables.",
    materials: "Vegetable-tanned leather, brass snaps",
    care: "Condition occasionally with leather balm.",
    tags: ["leather", "desk", "travel"],
    swatch: "#a0703f",
    addedDaysAgo: 90,
    variants: [
      { sku: "MM-WS-LCW-TAN", options: { Color: "Tan" }, priceMinor: 1900, inventory: 38 },
      { sku: "MM-WS-LCW-BLK", options: { Color: "Black" }, priceMinor: 1900, inventory: 21 },
    ],
  },

  // Travel Essentials
  {
    handle: "waxed-canvas-weekender",
    title: "Waxed Canvas Weekender",
    category: "travel-essentials",
    summary: "A roomy, water-resistant bag for two or three nights away.",
    description:
      "Paraffin-waxed cotton canvas with leather handles, a padded shoulder strap and an interior zip pocket. About 40 liters.",
    materials: "Waxed cotton canvas, leather trim, brass hardware",
    care: "Brush off dirt. Re-wax as needed. Do not machine wash.",
    tags: ["canvas", "bag"],
    featured: true,
    swatch: "#5f6446",
    addedDaysAgo: 70,
    variants: [
      { sku: "MM-TR-WCW-OLV", options: { Color: "Olive" }, priceMinor: 16800, inventory: 6 },
      { sku: "MM-TR-WCW-CHR", options: { Color: "Charcoal" }, priceMinor: 16800, inventory: 4 },
    ],
  },
  {
    handle: "packing-cubes-set",
    title: "Packing Cube Set (Set of 3)",
    category: "travel-essentials",
    summary: "Three nesting cubes in recycled ripstop with mesh tops.",
    description:
      "Small, medium and large cubes in lightweight recycled ripstop. Mesh tops show what is inside at a glance.",
    materials: "Recycled polyester ripstop, mesh",
    care: "Machine wash cold, line dry.",
    tags: ["packing", "bag"],
    swatch: "#cbbf9f",
    addedDaysAgo: 25,
    variants: [
      { sku: "MM-TR-PCS-SND", options: { Color: "Sand" }, priceMinor: 3900, inventory: 26 },
      { sku: "MM-TR-PCS-CHR", options: { Color: "Charcoal" }, priceMinor: 3900, inventory: 20 },
    ],
  },
  {
    handle: "leather-passport-wallet",
    title: "Leather Passport Wallet",
    category: "travel-essentials",
    summary: "Slim wallet for a passport, boarding pass and cards.",
    description:
      "Full-grain leather folio with a passport sleeve, four card slots and a full-length pocket for boarding passes.",
    materials: "Full-grain leather",
    care: "Condition occasionally with leather balm.",
    tags: ["leather", "documents"],
    swatch: "#8a5a36",
    addedDaysAgo: 85,
    variants: [
      { sku: "MM-TR-LPW-TAN", options: { Color: "Tan" }, priceMinor: 5400, inventory: 16 },
      { sku: "MM-TR-LPW-BLK", options: { Color: "Black" }, priceMinor: 5400, inventory: 10 },
    ],
  },
  {
    handle: "insulated-steel-bottle",
    title: "Insulated Steel Bottle",
    category: "travel-essentials",
    summary: "Double-walled bottle with a leak-proof bamboo cap.",
    description:
      "Vacuum-insulated stainless steel with a powder-coated finish and a bamboo-topped cap.",
    materials: "18/8 stainless steel, bamboo, silicone seal",
    care: "Hand wash only.",
    tags: ["steel", "hydration"],
    swatch: "#6f7d72",
    addedDaysAgo: 10,
    variants: [
      { sku: "MM-TR-ISB-500", options: { Size: "500 ml" }, priceMinor: 3200, inventory: 31 },
      { sku: "MM-TR-ISB-750", options: { Size: "750 ml" }, priceMinor: 3600, inventory: 22 },
    ],
  },
  {
    handle: "merino-travel-blanket",
    title: "Merino Travel Blanket",
    category: "travel-essentials",
    summary: "A lightweight merino wrap that packs into its own pouch.",
    description:
      "A fine-gauge merino wool blanket for planes, trains and cool evenings. Rolls into the included cotton pouch.",
    materials: "100% merino wool, cotton pouch",
    care: "Hand wash cold, dry flat.",
    tags: ["merino", "comfort"],
    featured: true,
    swatch: "#a39a8a",
    addedDaysAgo: 50,
    variants: [
      { sku: "MM-TR-MTB-OAT", options: { Color: "Oat" }, priceMinor: 11800, inventory: 9 },
      { sku: "MM-TR-MTB-CHR", options: { Color: "Charcoal" }, priceMinor: 11800, inventory: 5 },
    ],
  },
  {
    handle: "canvas-toiletry-roll",
    title: "Canvas Toiletry Roll",
    category: "travel-essentials",
    summary: "A hanging roll-up kit with zip pockets and a wipe-clean lining.",
    description:
      "Rolls up small and hangs from a hook. Three zip pockets with a water-resistant lining.",
    materials: "Cotton canvas, water-resistant lining, metal hook",
    care: "Wipe lining clean. Spot clean exterior.",
    tags: ["canvas", "bathroom"],
    swatch: "#d2c4a3",
    addedDaysAgo: 160,
    variants: [
      { sku: "MM-TR-CTR-SND", options: { Color: "Sand" }, priceMinor: 4200, inventory: 13 },
      { sku: "MM-TR-CTR-OLV", options: { Color: "Olive" }, priceMinor: 4200, inventory: 0 },
    ],
  },
  {
    handle: "silk-sleep-mask",
    title: "Mulberry Silk Sleep Mask",
    category: "travel-essentials",
    summary: "A soft, light-blocking mask in 22 momme mulberry silk.",
    description:
      "Mulberry silk on both sides with a cotton filling and an adjustable, covered strap.",
    materials: "22 momme mulberry silk, cotton filling",
    care: "Hand wash cold with a gentle detergent.",
    tags: ["silk", "sleep"],
    swatch: "#e7dfd2",
    addedDaysAgo: 5,
    variants: [
      { sku: "MM-TR-SSM-IVR", options: { Color: "Ivory" }, priceMinor: 2800, inventory: 29 },
      { sku: "MM-TR-SSM-CHR", options: { Color: "Charcoal" }, priceMinor: 2800, inventory: 17 },
    ],
  },
];

export const SEED_POLICIES: SeedPolicy[] = [
  {
    key: "shipping",
    title: "Shipping",
    summary: "Free standard shipping on US orders of $75 or more.",
    body: "Orders are dispatched within 2 business days. Standard shipping within the contiguous United States usually arrives 3–7 business days after dispatch. Standard shipping is free on orders of $75 or more and costs $8 below that. Delivery times are estimates, not guarantees.",
  },
  {
    key: "returns",
    title: "Returns",
    summary: "Return unused items within 30 days of delivery.",
    body: "Unused items in their original condition can be returned within 30 days of delivery for a refund to the original payment method. Return shipping is paid by the customer unless the item arrived damaged or incorrect. Personalized items cannot be returned.",
  },
  {
    key: "care-and-warranty",
    title: "Care & warranty",
    summary: "One-year warranty against manufacturing defects.",
    body: "Every product is covered for one year from delivery against defects in materials or workmanship. Natural materials such as wood, leather and linen will change with use. This is expected and not a defect.",
  },
  {
    key: "demo-store",
    title: "About this demo store",
    summary: "Mero & Moss is a demo store. Orders are simulated and no payment is taken.",
    body: "Mero & Moss is a fictional retailer used to demonstrate a working commerce system. Products, prices, stock levels and orders are synthetic demo data. Checkout creates simulated orders only; no payment is collected and nothing is shipped.",
  },
];
