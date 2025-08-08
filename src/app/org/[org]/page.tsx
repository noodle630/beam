import { supabase } from '@/lib/supabase'
import { notFound } from 'next/navigation'

interface Product {
  id: string
  title: string
  description: string
  price: number
  org_slug: string
}

interface PageProps {
  params: {
    org: string
  }
}

export default async function OrgPage({ params }: PageProps) {
  const { org } = params

  // Fetch products for this organization
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('org_slug', org)
    .order('title')

  if (error) {
    console.error('Error fetching products:', error)
    return <div className="p-6">Error loading products</div>
  }

  if (!products || products.length === 0) {
    notFound()
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{org} Products</h1>
        <p className="text-gray-600">Found {products.length} products</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product: Product) => (
          <div key={product.id} className="border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="text-xl font-semibold mb-2">{product.title}</h2>
            <p className="text-gray-600 mb-4 line-clamp-3">{product.description}</p>
            <div className="flex justify-between items-center">
              <span className="text-2xl font-bold text-green-600">
                ${parseFloat(product.price.toString()).toFixed(2)}
              </span>
              <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
} 