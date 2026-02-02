'use client';

import { useState, useEffect } from 'react';

type Category = {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  ai_system_context?: string;
};

export default function CategoryList() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/categories');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch categories');
      }

      setCategories(data.categories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const response = await fetch(`/api/categories/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete category');
      }

      setCategories(categories.filter((cat) => cat.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete category');
    }
  };

  if (loading) {
    return <div className="text-gray-600">Loading categories...</div>;
  }

  if (error) {
    return <div className="text-red-600">Error: {error}</div>;
  }

  if (categories.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No categories yet. Create your first one!
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <div
          key={category.id}
          className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          style={{ borderLeftColor: category.color || '#3b82f6', borderLeftWidth: '4px' }}
        >
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold text-lg">
              {category.icon && <span className="mr-2">{category.icon}</span>}
              {category.name}
            </h3>
            <button
              onClick={() => handleDelete(category.id)}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Delete
            </button>
          </div>
          {category.description && (
            <p className="text-gray-600 text-sm mb-2">{category.description}</p>
          )}
          {category.ai_system_context && (
            <p className="text-xs text-gray-400 italic">AI context configured</p>
          )}
        </div>
      ))}
    </div>
  );
}
