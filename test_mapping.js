const limechatStatus = {
  "ok": true,
  "order": {
    "id": "729892eb-c439-4880-b1df-6859d05be905",
    "status": "packed",
    "products": [
      {
        "id": "17679684337953",
        "title": "My Milestones Pull-On Cargo Jogger - Steel Blue- Steel Blue",
        "quantity": 1,
        "price": 899,
        "image": "..."
      },
      {
        "id": "17679684370721",
        "title": "Gig Girls Printed Cotton Blend Jogger Pants Dusty Pink Comfort Track",
        "quantity": 1,
        "price": 440,
        "image": "..."
      }
    ],
    "is_return": true,
    "is_exchange": true,
    "return_product_ids": [
      "52225471480097"
    ],
    "exchange_product_ids": [
      "52879361081633"
    ]
  }
};

const shopifyItems = [
  {
    variant: { id: "gid://shopify/ProductVariant/52225471480097" },
    title: "Shopify Title Returns",
    originalTotalPrice: { amount: "100" }
  },
  {
    variant: { id: "gid://shopify/ProductVariant/52879361081633" },
    title: "Shopify Title Exchange",
    originalTotalPrice: { amount: "200" }
  }
];

const allVariantIds = Array.from(new Set([
    ...(limechatStatus?.order?.products?.map((p) => p.id) || []),
    ...(shopifyItems?.map((i) => String(i.variant?.id).split('/').pop()) || [])
]));

const getDetails = (vid) => {
    const lp = limechatStatus?.order?.products?.find((p) => String(p.id) === String(vid));
    if (lp) {
        return {
            id: vid,
            title: lp.title || '',
            price: String(lp.price || '0'),
            quantity: lp.quantity || 1,
            image: lp.image || '',
        };
    }
    const shp = shopifyItems.find((i) => String(i.variant?.id).endsWith(String(vid)) || String(i.variant?.id).includes(String(vid)));
    if (shp) {
        return {
            id: vid,
            title: shp.title || '',
            price: shp.originalTotalPrice?.amount || '0',
            quantity: 1,
            image: shp.variant?.image?.url || '',
        };
    }
    console.log('[v2.tsx Returns Debug] No match found for vid:', vid);
    return null;
};

let returnsItems = (limechatStatus?.order?.return_product_ids || [])
    .map(getDetails)
    .filter(Boolean);

let exchangesItems = (limechatStatus?.order?.exchange_product_ids || [])
    .map(getDetails)
    .filter(Boolean);

if (limechatStatus?.order?.is_return && returnsItems.length === 0) {
    returnsItems = allVariantIds.map(getDetails).filter(Boolean);
}

if (limechatStatus?.order?.is_exchange && exchangesItems.length === 0) {
    exchangesItems = allVariantIds.map(getDetails).filter(Boolean);
}

console.log("returnsItems", returnsItems);
console.log("exchangesItems", exchangesItems);

