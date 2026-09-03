const fs = require('fs');
const file = '/Users/adarshdixit/Documents/delivery-partner-service/src/controllers/limechat.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('delayed_by: delayedByStr,', `delayed_by: delayedByStr,
        is_return: order.is_return,
        is_exchange: order.is_exchange,
        return_product_ids: order.return_product_ids,
        exchange_product_ids: order.exchange_product_ids,`);

fs.writeFileSync(file, content);
console.log('updated limechat.controller.ts');
