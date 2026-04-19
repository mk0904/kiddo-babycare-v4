/** Shopify CDN assets for milestone UI (from design HTML). */
export const MILESTONE_ASSETS = {
    firstActiveIcon:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/firstActiveIcon.png?v=1776446447',
    secondInactiveIcon:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/secondInActiveIcon.png?v=1776446446',
    thirdInactiveIcon:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/thirdInActiveIcon.png?v=1776446446',
    fourthInactiveIcon:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/fourthInActiveIcon.png?v=1776446446',
    verticalActiveLine:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/verCompLine.png?v=1776446463',
    verticalInactiveLine:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/verticalInActiveLine.png?v=1776446446',
    horCompLine:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/horCompLine.png?v=1776446446',
    horInActiveLine:
        'https://cdn.shopify.com/s/files/1/0961/2787/7409/files/horInActiveLine.png?v=1776446447',
} as const;

export const MILESTONE_NODE_IMAGES = [
    MILESTONE_ASSETS.firstActiveIcon,
    MILESTONE_ASSETS.secondInactiveIcon,
    MILESTONE_ASSETS.thirdInactiveIcon,
    MILESTONE_ASSETS.fourthInactiveIcon,
] as const;
