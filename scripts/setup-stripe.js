import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const plans = [
  {
    name: "Básico",
    description: "Analiza hasta 3 proyectos al mes.",
    amount: 9900, // CLP 9.900
    metadata: { planType: "basic" }
  },
  {
    name: "Pro",
    description: "Análisis ilimitados y funciones premium.",
    amount: 24900, // CLP 24.900
    metadata: { planType: "pro" }
  },
  {
    name: "Empresa",
    description: "Para equipos grandes y proyectos ilimitados.",
    amount: 59900, // CLP 59.900
    metadata: { planType: "enterprise" }
  }
];

async function setup() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Falta STRIPE_SECRET_KEY en el .env");
    return;
  }

  console.log("--- Iniciando configuración de Stripe (Test Mode) ---");

  for (const plan of plans) {
    try {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
        metadata: plan.metadata
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.amount,
        currency: 'clp',
        recurring: { interval: 'month' },
      });

      console.log(`✅ Creado: ${plan.name} - Price ID: ${price.id}`);
    } catch (err) {
      console.error(`❌ Error creando ${plan.name}:`, err.message);
    }
  }
  console.log("--- Fin de la configuración ---");
}

setup();
