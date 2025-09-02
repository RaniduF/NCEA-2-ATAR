// Portfolio management service using localStorage
import type { SelectedItem } from '../page';

export interface SavedPortfolio {
  id: string;
  name: string;
  description?: string;
  items: SelectedItem[];
  createdAt: string;
  updatedAt: string;
}

class PortfolioService {
  private readonly STORAGE_KEY = 'ncea-portfolios';
  private readonly CURRENT_PORTFOLIO_KEY = 'ncea-current-portfolio';
  private readonly AUTO_SAVE_KEY = 'ncea-auto-save';

  // Get all saved portfolios
  getPortfolios(): SavedPortfolio[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading portfolios:', error);
      return [];
    }
  }

  // Save a new portfolio
  savePortfolio(name: string, items: SelectedItem[], description?: string): SavedPortfolio {
    const portfolios = this.getPortfolios();
    const now = new Date().toISOString();
    
    const newPortfolio: SavedPortfolio = {
      id: `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      items: JSON.parse(JSON.stringify(items)), // Deep clone
      createdAt: now,
      updatedAt: now
    };

    portfolios.push(newPortfolio);
    this.setPortfolios(portfolios);
    return newPortfolio;
  }

  // Update an existing portfolio
  updatePortfolio(id: string, updates: Partial<Pick<SavedPortfolio, 'name' | 'description' | 'items'>>): SavedPortfolio | null {
    const portfolios = this.getPortfolios();
    const index = portfolios.findIndex(p => p.id === id);
    
    if (index === -1) return null;

    portfolios[index] = {
      ...portfolios[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.setPortfolios(portfolios);
    return portfolios[index];
  }

  // Delete a portfolio
  deletePortfolio(id: string): boolean {
    const portfolios = this.getPortfolios();
    const filtered = portfolios.filter(p => p.id !== id);
    
    if (filtered.length === portfolios.length) return false;
    
    this.setPortfolios(filtered);
    return true;
  }

  // Get a specific portfolio
  getPortfolio(id: string): SavedPortfolio | null {
    const portfolios = this.getPortfolios();
    return portfolios.find(p => p.id === id) || null;
  }

  // Auto-save current portfolio state
  autoSave(items: SelectedItem[]): void {
    try {
      const autoSaveData = {
        items: JSON.parse(JSON.stringify(items)),
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(this.AUTO_SAVE_KEY, JSON.stringify(autoSaveData));
    } catch (error) {
      console.error('Error auto-saving portfolio:', error);
    }
  }

  // Load auto-saved portfolio
  loadAutoSave(): SelectedItem[] | null {
    try {
      const data = localStorage.getItem(this.AUTO_SAVE_KEY);
      if (!data) return null;
      
      const autoSaveData = JSON.parse(data);
      const timestamp = new Date(autoSaveData.timestamp);
      const hoursSinceAutoSave = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
      
      // Only restore if auto-save is less than 24 hours old
      if (hoursSinceAutoSave < 24) {
        return autoSaveData.items || [];
      }
      
      // Clear old auto-save
      localStorage.removeItem(this.AUTO_SAVE_KEY);
      return null;
    } catch (error) {
      console.error('Error loading auto-save:', error);
      return null;
    }
  }

  // Clear auto-save (when user explicitly saves or clears)
  clearAutoSave(): void {
    localStorage.removeItem(this.AUTO_SAVE_KEY);
  }

  // Set current active portfolio
  setCurrentPortfolio(items: SelectedItem[]): void {
    try {
      localStorage.setItem(this.CURRENT_PORTFOLIO_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving current portfolio:', error);
    }
  }

  // Get current active portfolio
  getCurrentPortfolio(): SelectedItem[] | null {
    try {
      const data = localStorage.getItem(this.CURRENT_PORTFOLIO_KEY);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error loading current portfolio:', error);
      return null;
    }
  }

  // Export portfolio as JSON
  exportPortfolio(id: string): string | null {
    const portfolio = this.getPortfolio(id);
    if (!portfolio) return null;
    
    return JSON.stringify(portfolio, null, 2);
  }

  // Import portfolio from JSON
  importPortfolio(jsonData: string): SavedPortfolio | null {
    try {
      const data = JSON.parse(jsonData);
      
      // Validate portfolio structure
      if (!data.name || !Array.isArray(data.items)) {
        throw new Error('Invalid portfolio format');
      }

      return this.savePortfolio(
        `${data.name} (Imported)`,
        data.items,
        data.description
      );
    } catch (error) {
      console.error('Error importing portfolio:', error);
      return null;
    }
  }

  // Get storage usage info
  getStorageInfo(): { used: number; available: number; portfolioCount: number } {
    const portfolios = this.getPortfolios();
    const currentData = localStorage.getItem(this.STORAGE_KEY) || '';
    const autoSaveData = localStorage.getItem(this.AUTO_SAVE_KEY) || '';
    
    const used = new Blob([currentData + autoSaveData]).size;
    const available = 5 * 1024 * 1024; // Estimate 5MB localStorage limit
    
    return {
      used,
      available,
      portfolioCount: portfolios.length
    };
  }

  private setPortfolios(portfolios: SavedPortfolio[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(portfolios));
    } catch (error) {
      console.error('Error saving portfolios:', error);
      throw new Error('Failed to save portfolio. Storage may be full.');
    }
  }
}

// Export singleton instance
export const portfolioService = new PortfolioService(); 