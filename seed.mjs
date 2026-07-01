import { Client, Users, Databases, ID, Query } from 'node-appwrite';
import fs from 'fs';
import path from 'path';

// Parse .env file
const envPath = path.resolve('.env');
const envData = fs.readFileSync(envPath, 'utf8');
const env = {};
envData.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const endpoint = env.VITE_APPWRITE_ENDPOINT;
const projectId = env.VITE_APPWRITE_PROJECT_ID;
const databaseId = env.VITE_APPWRITE_DATABASE_ID;
const apiKey = env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  console.error('Missing configuration in .env file!');
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const users = new Users(client);
const db = new Databases(client);

async function main() {
  const targetEmail = 'mohit.2428cs2536@kiet.edu';
  console.log(`Searching for user with email: ${targetEmail}...`);

  let userDetails;
  try {
    const listRes = await users.list([Query.equal('email', targetEmail)]);
    if (listRes.users.length === 0) {
      console.error(`User with email ${targetEmail} not found in Appwrite Auth!`);
      process.exit(1);
    }
    userDetails = listRes.users[0];
  } catch (err) {
    console.error('Failed to query users from Appwrite:', err);
    process.exit(1);
  }

  const userId = userDetails.$id;
  const userName = userDetails.name || 'Mohit Sharma';
  console.log(`Found user: ${userName} (ID: ${userId})`);

  // Get active shop ID from profile
  const profile = await db.getDocument(databaseId, 'profiles', userId);
  const shopId = profile.active_shop_id;
  
  if (!shopId) {
    console.error('User does not have an active shop ID selected in their profile!');
    process.exit(1);
  }

  console.log(`Targeting current active shop: ${shopId}`);

  // Rename the shop to Mohit's Supermart so it looks correct
  try {
    await db.updateDocument(databaseId, 'shops', shopId, {
      name: "Mohit's Supermart",
    });
    console.log('Renamed active shop to "Mohit\'s Supermart"');
  } catch (err) {
    console.error('Failed to rename shop:', err);
  }

  // 3. Seed Categories
  console.log('Seeding categories...');
  const categoryNames = [
    { name: 'Beverages', color: '#3b82f6', slug: 'beverages' },
    { name: 'Dairy & Bread', color: '#10b981', slug: 'dairy-bread' },
    { name: 'Snacks & Biscuits', color: '#f59e0b', slug: 'snacks-biscuits' },
    { name: 'Groceries & Staples', color: '#8b5cf6', slug: 'groceries-staples' },
    { name: 'Household & Personal Care', color: '#ec4899', slug: 'household-care' },
  ];

  const categoryMap = new Map();
  for (const cat of categoryNames) {
    const listRes = await db.listDocuments(databaseId, 'categories', [
      Query.equal('shop_id', shopId),
      Query.equal('slug', cat.slug),
    ]);

    let catDoc;
    if (listRes.documents.length > 0) {
      catDoc = listRes.documents[0];
      console.log(`Category "${cat.name}" already exists.`);
    } else {
      catDoc = await db.createDocument(databaseId, 'categories', ID.unique(), {
        shop_id: shopId,
        name: cat.name,
        slug: cat.slug,
        color: cat.color,
        parent_id: null,
        sort_order: 0,
      });
      console.log(`Created category: ${cat.name}`);
    }
    categoryMap.set(cat.name, catDoc.$id);
  }

  // 4. Seed Products
  console.log('Seeding products...');
  const productsToSeed = [
    {
      category: 'Beverages',
      name: 'Coca-Cola Zero Sugar Can 300ml',
      mrp: 40,
      sale_price: 38,
      cost_price: 30,
      sku: 'COKE-ZERO-300',
      barcode: '8901764032217',
      opening_stock: 120,
    },
    {
      category: 'Beverages',
      name: 'Sprite Lemon Drink 750ml',
      mrp: 45,
      sale_price: 42,
      cost_price: 33,
      sku: 'SPRITE-750',
      barcode: '8901764012257',
      opening_stock: 80,
    },
    {
      category: 'Beverages',
      name: 'Red Bull Energy Drink 250ml',
      mrp: 125,
      sale_price: 115,
      cost_price: 90,
      sku: 'REDBULL-250',
      barcode: '9002490100070',
      opening_stock: 60,
    },
    {
      category: 'Dairy & Bread',
      name: 'Amul Taza Fresh Toned Milk 1L',
      mrp: 66,
      sale_price: 64,
      cost_price: 58,
      sku: 'AMUL-MILK-1L',
      barcode: '8901262151241',
      opening_stock: 50,
    },
    {
      category: 'Dairy & Bread',
      name: 'Amul Salted Butter 500g',
      mrp: 275,
      sale_price: 265,
      cost_price: 230,
      sku: 'AMUL-BUTTER-500',
      barcode: '8901262010128',
      opening_stock: 40,
    },
    {
      category: 'Dairy & Bread',
      name: 'Harvest Gold Brown Bread 400g',
      mrp: 50,
      sale_price: 48,
      cost_price: 40,
      sku: 'BREAD-BROWN-400',
      barcode: '8906017240032',
      opening_stock: 30,
    },
    {
      category: 'Snacks & Biscuits',
      name: 'Lays India\'s Magic Masala Chips 50g',
      mrp: 20,
      sale_price: 20,
      cost_price: 15,
      sku: 'LAYS-MASALA-50',
      barcode: '8901491101836',
      opening_stock: 200,
    },
    {
      category: 'Snacks & Biscuits',
      name: 'Kurkure Masala Munch 90g',
      mrp: 30,
      sale_price: 28,
      cost_price: 22,
      sku: 'KURKURE-90',
      barcode: '8901491501179',
      opening_stock: 150,
    },
    {
      category: 'Snacks & Biscuits',
      name: 'Oreo Original Chocolate Biscuits 120g',
      mrp: 40,
      sale_price: 38,
      cost_price: 30,
      sku: 'OREO-CHOCO-120',
      barcode: '7622201140026',
      opening_stock: 100,
    },
    {
      category: 'Groceries & Staples',
      name: 'Fortune Soya Health Refined Oil 1L',
      mrp: 145,
      sale_price: 135,
      cost_price: 110,
      sku: 'FORTUNE-SOYA-1L',
      barcode: '8906007284725',
      opening_stock: 75,
    },
    {
      category: 'Groceries & Staples',
      name: 'Aashirvaad Shudh Chakki Atta 5kg',
      mrp: 260,
      sale_price: 245,
      cost_price: 210,
      sku: 'AASHIRVAAD-ATTA-5K',
      barcode: '8901725181220',
      opening_stock: 50,
    },
    {
      category: 'Groceries & Staples',
      name: 'Tata Salt Vaccum Evaporated Iodised 1kg',
      mrp: 28,
      sale_price: 28,
      cost_price: 22,
      sku: 'TATA-SALT-1K',
      barcode: '8901058002316',
      opening_stock: 100,
    },
    {
      category: 'Household & Personal Care',
      name: 'Dettol Liquid Handwash Refill 175ml',
      mrp: 99,
      sale_price: 89,
      cost_price: 70,
      sku: 'DETTOL-HW-175',
      barcode: '8901396328321',
      opening_stock: 60,
    },
    {
      category: 'Household & Personal Care',
      name: 'Vim Dishwash Gel Lemon 500ml',
      mrp: 125,
      sale_price: 115,
      cost_price: 90,
      sku: 'VIM-GEL-500',
      barcode: '8901030753083',
      opening_stock: 80,
    },
    {
      category: 'Household & Personal Care',
      name: 'Surf Excel Easy Wash Detergent Powder 1kg',
      mrp: 140,
      sale_price: 130,
      cost_price: 105,
      sku: 'SURF-EXCEL-1K',
      barcode: '8901030691767',
      opening_stock: 60,
    },
  ];

  const productList = [];
  for (const p of productsToSeed) {
    const listRes = await db.listDocuments(databaseId, 'products', [
      Query.equal('shop_id', shopId),
      Query.equal('sku', p.sku),
    ]);

    let prodDoc;
    if (listRes.documents.length > 0) {
      prodDoc = listRes.documents[0];
      console.log(`Product "${p.name}" already exists.`);
    } else {
      const categoryId = categoryMap.get(p.category);
      prodDoc = await db.createDocument(databaseId, 'products', ID.unique(), {
        shop_id: shopId,
        category_id: categoryId || null,
        name: p.name,
        description: `${p.name} - high quality grocery product.`,
        sku: p.sku,
        barcode: p.barcode,
        unit: 'pcs',
        mrp: p.mrp,
        sale_price: p.sale_price,
        cost_price: p.cost_price,
        tax_rate: 18,
        hsn_code: '210690',
        image_url: null,
        track_stock: true,
        reorder_level: 10,
        is_active: true,
        created_by: userId,
        stock_qty: p.opening_stock,
      });

      console.log(`Created product: ${p.name}`);

      // Log opening stock movement
      await db.createDocument(databaseId, 'stock_movements', ID.unique(), {
        shop_id: shopId,
        product_id: prodDoc.$id,
        type: 'opening',
        quantity: p.opening_stock,
        note: 'Opening stock',
        created_by: userId,
      });
    }
    productList.push(prodDoc);
  }

  // 5. Seed Suppliers
  console.log('Seeding suppliers...');
  const suppliersToSeed = [
    { name: 'Amul Distributors Ghaziabad', contact_person: 'Amit Kumar', phone: '9811122233', email: 'amit@amuldist.com' },
    { name: 'Frito-Lay India Logistics', contact_person: 'Sanjay Dutt', phone: '9822233344', email: 'sanjay@fritolay.com' },
    { name: 'Hindustan Unilever Wholesale', contact_person: 'Vikram Singh', phone: '9833344455', email: 'vikram@hulwholesale.com' },
  ];

  const supplierList = [];
  for (const s of suppliersToSeed) {
    const listRes = await db.listDocuments(databaseId, 'suppliers', [
      Query.equal('shop_id', shopId),
      Query.equal('name', s.name),
    ]);

    let suppDoc;
    if (listRes.documents.length > 0) {
      suppDoc = listRes.documents[0];
      console.log(`Supplier "${s.name}" already exists.`);
    } else {
      suppDoc = await db.createDocument(databaseId, 'suppliers', ID.unique(), {
        shop_id: shopId,
        name: s.name,
        contact_person: s.contact_person,
        phone: s.phone,
        email: s.email,
        address: 'Sector 4, Industrial Area, Ghaziabad',
        gstin: '09AAAHUL9988A1Z0',
        notes: 'Reliable delivery partner.',
        is_active: true,
        created_by: userId,
      });
      console.log(`Created supplier: ${s.name}`);
    }
    supplierList.push(suppDoc);
  }

  // 6. Seed Customers
  console.log('Seeding customers...');
  const customersToSeed = [
    { name: 'Aarav Mehta', phone: '9988998899', email: 'aarav@gmail.com', address: 'Block C, KIET Hostels' },
    { name: 'Ishita Sharma', phone: '9977886655', email: 'ishita@gmail.com', address: 'Girls Hostel, KIET' },
    { name: 'Kabir Singh', phone: '9888999900', email: 'kabir@gmail.com', address: 'Ghazipur Metro Station Area' },
    { name: 'Rohan Gupta', phone: '9555666777', email: 'rohan@gmail.com', address: 'Sector 15, Vasundhara' },
    { name: 'Priyal Patel', phone: '9444555666', email: 'priyal@gmail.com', address: 'Indirapuram, Ghaziabad' },
  ];

  const customerList = [];
  for (const c of customersToSeed) {
    const listRes = await db.listDocuments(databaseId, 'customers', [
      Query.equal('shop_id', shopId),
      Query.equal('name', c.name),
    ]);

    let custDoc;
    if (listRes.documents.length > 0) {
      custDoc = listRes.documents[0];
      console.log(`Customer "${c.name}" already exists.`);
    } else {
      custDoc = await db.createDocument(databaseId, 'customers', ID.unique(), {
        shop_id: shopId,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        credit_limit: 10000,
        notes: 'Regular local customer.',
        balance: 0,
        created_by: userId,
      });
      console.log(`Created customer: ${c.name}`);
    }
    customerList.push(custDoc);
  }

  // 7. Seed Counters if missing
  try {
    await db.getDocument(databaseId, 'counters', shopId);
  } catch (err) {
    if (err.code === 404) {
      console.log('Initializing counter for invoice numbers...');
      await db.createDocument(databaseId, 'counters', shopId, {
        current_value: 0,
      });
    }
  }

  // 8. Seed Sales spread across last 30 days
  console.log('Seeding sales (last 30 days)...');
  const salesCountRes = await db.listDocuments(databaseId, 'sales', [
    Query.equal('shop_id', shopId),
    Query.limit(1),
  ]);

  if (salesCountRes.documents.length > 0) {
    console.log('Sales already seeded.');
  } else {
    // Let's seed 15 sales
    for (let dayOffset = 30; dayOffset >= 1; dayOffset -= 2) {
      const invoiceDate = new Date();
      invoiceDate.setDate(invoiceDate.getDate() - dayOffset);
      invoiceDate.setHours(10 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60), 0, 0);

      // Random customer
      const cust = customerList[Math.floor(Math.random() * customerList.length)];
      
      // Select 1 to 3 random products
      const count = 1 + Math.floor(Math.random() * 3);
      const selectedProducts = [];
      const usedIds = new Set();
      while (selectedProducts.length < count) {
        const p = productList[Math.floor(Math.random() * productList.length)];
        if (!usedIds.has(p.$id)) {
          selectedProducts.push(p);
          usedIds.add(p.$id);
        }
      }

      let subtotal = 0;
      let taxTotal = 0;
      const items = selectedProducts.map((p) => {
        const qty = 1 + Math.floor(Math.random() * 4);
        const gross = qty * p.sale_price;
        const tax = (gross * p.tax_rate) / 100;
        subtotal += gross;
        taxTotal += tax;
        return {
          product_id: p.$id,
          name: p.name,
          quantity: qty,
          unit_price: p.sale_price,
          unit_cost: p.cost_price,
          tax_rate: p.tax_rate,
          discount: 0,
          line_total: gross + tax,
        };
      });

      const total = Math.round(subtotal + taxTotal);
      
      // Invoice counter update
      let currentVal = 0;
      try {
        const counterDoc = await db.getDocument(databaseId, 'counters', shopId);
        currentVal = Number(counterDoc.current_value || 0);
      } catch {}
      const newVal = currentVal + 1;
      await db.updateDocument(databaseId, 'counters', shopId, { current_value: newVal });
      const invoiceNumber = 'INV-' + String(newVal).padStart(6, '0');

      // Pay method: 70% cash/UPI, 30% credit
      const isCredit = Math.random() > 0.7;
      const payment_method = isCredit ? 'credit' : (Math.random() > 0.5 ? 'cash' : 'upi');
      const paid = isCredit ? 0 : total;
      const change_due = 0;
      const payment_status = paid >= total ? 'paid' : 'unpaid';

      const saleId = ID.unique();
      await db.createDocument(databaseId, 'sales', saleId, {
        shop_id: shopId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate.toISOString(),
        customer_id: cust.$id,
        customer_name: cust.name,
        customer_phone: cust.phone,
        subtotal,
        tax_total: taxTotal,
        discount: 0,
        round_off: 0,
        total,
        amount_paid: paid,
        change_due,
        payment_method,
        payment_status,
        notes: 'Simulated test sale.',
        status: 'completed',
        created_by: userId,
      });

      // Write items, movements, and ledger
      for (const item of items) {
        await db.createDocument(databaseId, 'sale_items', ID.unique(), {
          sale_id: saleId,
          shop_id: shopId,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          unit_cost: item.unit_cost,
          tax_rate: item.tax_rate,
          discount: item.discount,
          line_total: item.line_total,
        });

        // Stock movement (reduces stock)
        await db.createDocument(databaseId, 'stock_movements', ID.unique(), {
          shop_id: shopId,
          product_id: item.product_id,
          type: 'sale',
          quantity: item.quantity,
          unit_cost: item.unit_price,
          reference: invoiceNumber,
          note: 'POS sale',
          created_by: userId,
        });

        // Decrease product stock
        try {
          const freshProd = await db.getDocument(databaseId, 'products', item.product_id);
          const currentStock = Number(freshProd.stock_qty || 0);
          await db.updateDocument(databaseId, 'products', item.product_id, {
            stock_qty: Math.max(0, currentStock - item.quantity),
          });
        } catch {}
      }

      if (isCredit) {
        // Customer Ledger & update customer balance
        await db.createDocument(databaseId, 'customer_ledger', ID.unique(), {
          shop_id: shopId,
          customer_id: cust.$id,
          type: 'credit_sale',
          amount: total,
          sale_id: saleId,
          reference: invoiceNumber,
          note: 'Credit on invoice',
          created_by: userId,
        });

        const freshCust = await db.getDocument(databaseId, 'customers', cust.$id);
        const currentBal = Number(freshCust.balance || 0);
        await db.updateDocument(databaseId, 'customers', cust.$id, {
          balance: currentBal + total,
        });
      }
      console.log(`Generated Sale: ${invoiceNumber} (${payment_method}) on ${invoiceDate.toDateString()}`);
    }
  }

  // 9. Seed Purchases
  console.log('Seeding purchase orders...');
  const purchasesCountRes = await db.listDocuments(databaseId, 'purchases', [
    Query.equal('shop_id', shopId),
    Query.limit(1),
  ]);

  if (purchasesCountRes.documents.length > 0) {
    console.log('Purchases already seeded.');
  } else {
    for (let dayOffset = 25; dayOffset >= 5; dayOffset -= 5) {
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() - dayOffset);

      const supp = supplierList[Math.floor(Math.random() * supplierList.length)];
      const prod = productList[Math.floor(Math.random() * productList.length)];
      const qty = 50 + Math.floor(Math.random() * 50);

      const gross = qty * prod.cost_price;
      const tax = (gross * prod.tax_rate) / 100;
      const total = Math.round(gross + tax);

      const purchaseId = ID.unique();
      const invoiceNum = `PUR-${1000 + dayOffset}`;

      await db.createDocument(databaseId, 'purchases', purchaseId, {
        shop_id: shopId,
        supplier_id: supp.$id,
        invoice_number: invoiceNum,
        invoice_date: orderDate.toISOString(),
        subtotal: gross,
        tax_total: tax,
        discount: 0,
        other_charges: 0,
        total,
        amount_paid: total,
        payment_status: 'paid',
        notes: 'Simulated restocking purchase.',
        created_by: userId,
      });

      await db.createDocument(databaseId, 'purchase_items', ID.unique(), {
        purchase_id: purchaseId,
        shop_id: shopId,
        product_id: prod.$id,
        quantity: qty,
        unit_cost: prod.cost_price,
        tax_rate: prod.tax_rate,
        discount: 0,
        line_total: total,
      });

      await db.createDocument(databaseId, 'stock_movements', ID.unique(), {
        shop_id: shopId,
        product_id: prod.$id,
        type: 'purchase',
        quantity: qty,
        unit_cost: prod.cost_price,
        reference: invoiceNum,
        note: 'Restocking purchase',
        created_by: userId,
      });

      // Increase product stock
      try {
        const freshProd = await db.getDocument(databaseId, 'products', prod.$id);
        const currentStock = Number(freshProd.stock_qty || 0);
        await db.updateDocument(databaseId, 'products', prod.$id, {
          stock_qty: currentStock + qty,
        });
      } catch {}

      console.log(`Generated Purchase: ${invoiceNum} on ${orderDate.toDateString()}`);
    }
  }

  console.log('\n=======================================');
  console.log('Dummy Data Seeding Completed Successfully! 🎉');
  console.log(`User: ${userName} (${targetEmail})`);
  console.log(`Shop: "Mohit's Supermart" (ID: ${shopId})`);
  console.log('=======================================');
}

main().catch(console.error);
