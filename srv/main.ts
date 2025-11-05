
import cds, { Request, Service } from '@sap/cds';

import { Customers, Product, Products, SalesOrderHeaders, SalesOrderItem, SalesOrderItems } from '@models/sales';

export default (service: Service) => {

    service.after('READ', 'Customers', (results: Customers) => {
        results.forEach(customer => {
            if (!customer.email?.includes('@')) {
                customer.email = `${customer.email}@gmail.com`;
            }
        })
    });

    service.before('CREATE', 'SalesOrderHeaders', async (request: Request) => {
        const params = request.data;
        const items: SalesOrderItems = params.items;
        if (!params.customer_id) {
            return request.reject(400, 'Customer invalid!');
        }
        if (!params.items || params.items?.length === 0) {
            return request.reject(400, 'Invalid items!');
        }
        const customerQuery = SELECT.one.from('sales.Customers').where({ id: params.customer_id });
        const customer = await cds.run(customerQuery);
        console.log(customer);
        if (!customer) {
            return request.reject(404, 'Customer not found');
        }
        // ---------------
        const productsIds: string[] = params.items.map((item: SalesOrderItem) => item.product_id);
        const productsQuery = SELECT.from('sales.Products').where({ id: productsIds });
        const products: Products = await cds.run(productsQuery);
        const dbProducts = products.map((product: Product) => product.id);
        for (const item of items) {
            const dbProduct = products.find(product => product.id === item.product_id);
            if (!dbProduct) {
                return request.reject(404, `Product ${item.product_id} not found`);
            }
            if (dbProduct.stock === 0) {
                return request.reject(400, `Product ${dbProduct.name} (${dbProduct.id}) no stock available`);
            }
        }
    });

    service.after('CREATE', 'SalesOrderHeaders', async (results: SalesOrderHeaders) => {
        const headerAsArray = Array.isArray(results) ? results : [results] as SalesOrderHeaders;
        for (const header of headerAsArray) {
            const items = header.items as SalesOrderItems;
            const productsData = items.map(item => ({
                id: item.product_id as string,
                quantity: item.quantity as number
            }));
            const productsIds: string[] = productsData.map((productData) => productData.id);
            const productsQuery = SELECT.from('sales.Products').where({ id: productsIds });
            const products: Products = await cds.run(productsQuery);
            for (const productData of productsData) {
                const foundProduct = products.find(product => product.id === productData.id) as Product;
                foundProduct.stock = (foundProduct.stock as number) - productData.quantity;
                await cds.update('sales.Products').where({ id: foundProduct.id }).with({ stock: foundProduct.stock });
            }
        }
    });

}