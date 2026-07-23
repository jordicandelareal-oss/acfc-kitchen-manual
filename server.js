const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase Client
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-supabase-url.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'your-supabase-anon-key';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * 1. Calculate Ingredient Explosion (Previsión de compras)
 * GET /api/forecast?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
app.get('/api/forecast', async (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Missing startDate or endDate parameters' });
    }

    try {
        // Step A: Fetch all menu plannings in range
        const { data: menuItems, error: menuError } = await supabase
            .from('menu_planning')
            .select(`
                servings,
                recipes (
                    id,
                    name,
                    recipe_ingredients (
                        ingredient_id,
                        quantity,
                        unit,
                        ingredients (
                            name,
                            category,
                            current_stock,
                            min_stock
                        )
                    )
                )
            `)
            .gte('planning_date', startDate)
            .lte('planning_date', endDate);

        if (menuError) throw menuError;

        // Step B: Aggregate total required ingredients
        const requiredIngredients = {};

        menuItems.forEach(menu => {
            if (!menu.recipes || !menu.recipes.recipe_ingredients) return;
            
            const servings = menu.servings || 10;
            menu.recipes.recipe_ingredients.forEach(ri => {
                const ingId = ri.ingredient_id;
                const ingDetails = ri.ingredients;
                if (!requiredIngredients[ingId]) {
                    requiredIngredients[ingId] = {
                        id: ingId,
                        name: ingDetails.name,
                        category: ingDetails.category,
                        current_stock: parseFloat(ingDetails.current_stock || 0),
                        min_stock: parseFloat(ingDetails.min_stock || 0),
                        unit: ri.unit,
                        total_needed: 0
                    };
                }
                // quantity is per portion
                requiredIngredients[ingId].total_needed += parseFloat(ri.quantity) * servings;
            });
        });

        // Step C: Calculate net purchase forecast
        const forecast = Object.values(requiredIngredients).map(item => {
            const net_needed = item.total_needed - item.current_stock;
            // Purchase is triggered if we go below min_stock
            const purchase_qty = (item.current_stock - item.total_needed) < item.min_stock
                ? (item.total_needed + item.min_stock) - item.current_stock
                : 0;

            return {
                ...item,
                net_needed: Math.max(0, net_needed),
                purchase_qty: Math.max(0, purchase_qty),
                status: purchase_qty > 0 ? 'REORDER' : 'OK'
            };
        });

        res.json({
            date_range: { startDate, endDate },
            forecast: forecast.filter(f => f.total_needed > 0)
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * 2. Generate Optimized Purchase Orders
 * POST /api/purchase-orders/optimize
 * Payload: { forecast: [ { ingredient_id, purchase_qty, unit } ] }
 */
app.post('/api/purchase-orders/optimize', async (req, res) => {
    const { items, budget_id } = req.body; // array of { ingredient_id, quantity }
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing or invalid items array' });
    }

    try {
        const orderGroups = {}; // supplier_id -> [ { ingredient_id, quantity, price_per_unit } ]

        // Step A: For each item, find supplier with lowest price_per_unit
        for (const item of items) {
            const { data: prices, error: priceError } = await supabase
                .from('supplier_prices')
                .select('supplier_id, price_per_unit, presentation')
                .eq('ingredient_id', item.ingredient_id)
                .order('price_per_unit', { ascending: true })
                .limit(1);

            if (priceError) throw priceError;

            if (prices && prices.length > 0) {
                const bestPrice = prices[0];
                const supplierId = bestPrice.supplier_id;

                if (!orderGroups[supplierId]) {
                    orderGroups[supplierId] = [];
                }
                orderGroups[supplierId].push({
                    ingredient_id: item.ingredient_id,
                    quantity: item.quantity,
                    price_per_unit: bestPrice.price_per_unit,
                    unit: item.unit || 'gr'
                });
            } else {
                // No supplier found for this ingredient, skip or assign to a default
                console.warn(`No supplier prices found for ingredient: ${item.ingredient_id}`);
            }
        }

        // Step B: Create Purchase Orders
        const createdOrders = [];

        for (const supplierId of Object.keys(orderGroups)) {
            const orderItems = orderGroups[supplierId];
            const totalAmount = orderItems.reduce((sum, item) => sum + (item.quantity * item.price_per_unit), 0);

            // 1. Insert Purchase Order Header
            const { data: po, error: poError } = await supabase
                .from('purchase_orders')
                .insert({
                    supplier_id: supplierId,
                    budget_id: budget_id || null,
                    total_amount: parseFloat(totalAmount.toFixed(2)),
                    status: 'draft'
                })
                .select()
                .single();

            if (poError) throw poError;

            // 2. Insert Purchase Order Items
            const itemsToInsert = orderItems.map(item => ({
                purchase_order_id: po.id,
                ingredient_id: item.ingredient_id,
                quantity: item.quantity,
                unit: item.unit,
                price_per_unit: item.price_per_unit
            }));

            const { error: itemsError } = await supabase
                .from('purchase_order_items')
                .insert(itemsToInsert);

            if (itemsError) throw itemsError;

            createdOrders.push({
                order_id: po.id,
                supplier_id: supplierId,
                total_amount: po.total_amount,
                items_count: itemsToInsert.length
            });
        }

        // Step C: Update budget if applicable
        if (budget_id && createdOrders.length > 0) {
            const totalSpent = createdOrders.reduce((sum, o) => sum + o.total_amount, 0);
            await supabase.rpc('increment_budget_spent', { budget_id, amount: totalSpent });
        }

        res.json({
            success: true,
            orders_created: createdOrders
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`ACFC Gastronomic SaaS API Server running on port ${PORT}`);
});
