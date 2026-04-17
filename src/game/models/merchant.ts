/** 商人商品定义 */
export interface MerchantItem {
    id: string;
    label: string;
    description: string;
    price: number;
    icon?: string;
}

/** 商人商品列表 */
export const MERCHANT_ITEMS: Readonly<MerchantItem[]> = [
    {
        id: 'auto-movement',
        label: '自动移动能力',
        description: '解锁自动移动功能，角色可在地牢中自主探索',
        price: 500,
    },
];
