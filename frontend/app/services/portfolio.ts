import type { SelectedItem, Grade } from '../page';

export interface SavedPortfolio {
  id: string;
  name: string;
  description?: string;
  items: SelectedItem[];
  createdAt: string;
  updatedAt: string;
}

export function sanitizeInputText(text: string, maxLength: number): string {
  if (!text) return '';
  // Strip HTML tags using regex
  const stripped = text.replace(/<[^>]*>/g, '');
  // Truncate to maxLength
  return stripped.slice(0, maxLength).trim();
}

class PortfolioService {
  private readonly STORAGE_KEY = 'ncea-portfolios';
  private readonly CURRENT_PORTFOLIO_KEY = 'ncea-current-portfolio';
  private readonly AUTO_SAVE_KEY = 'ncea-auto-save';

  private validateAndSanitizeItems(items: any[]): SelectedItem[] {
    if (!Array.isArray(items)) return [];
    const validGrades = new Set(['Excellence', 'Merit', 'Achieved', 'Not Achieved']);
    
    return items
      .filter(item => {
        return (
          item &&
          item.standard &&
          typeof item.standard.standard_number === 'number' &&
          typeof item.standard.title === 'string' &&
          typeof item.standard.credits === 'number' &&
          validGrades.has(item.grade)
        );
      })
      .map(item => {
        const std = item.standard;
        return {
          standard: {
            standard_number: std.standard_number,
            title: sanitizeInputText(std.title, 200),
            credits: std.credits,
            assessment_type: typeof std.assessment_type === 'string' ? sanitizeInputText(std.assessment_type, 50) : null,
            standards_type: typeof std.standards_type === 'string' ? sanitizeInputText(std.standards_type, 50) : null,
            is_ue: Boolean(std.is_ue),
            subject: typeof std.subject === 'string' ? sanitizeInputText(std.subject, 100) : null,
          },
          grade: item.grade as Grade,
          year_achieved: typeof item.year_achieved === 'number' ? item.year_achieved : undefined,
          standard_version: typeof item.standard_version === 'number' ? item.standard_version : undefined,
        };
      });
  }

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
    
    const sanitizedName = sanitizeInputText(name, 100) || 'My Portfolio';
    const sanitizedDescription = description ? sanitizeInputText(description, 500) : undefined;
    const validatedItems = this.validateAndSanitizeItems(items);
    
    const newPortfolio: SavedPortfolio = {
      id: `portfolio_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: sanitizedName,
      description: sanitizedDescription,
      items: validatedItems,
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

    const sanitizedUpdates: Partial<Pick<SavedPortfolio, 'name' | 'description' | 'items'>> = {};
    if (updates.name !== undefined) {
      sanitizedUpdates.name = sanitizeInputText(updates.name, 100) || 'My Portfolio';
    }
    if (updates.description !== undefined) {
      sanitizedUpdates.description = updates.description ? sanitizeInputText(updates.description, 500) : undefined;
    }
    if (updates.items !== undefined) {
      sanitizedUpdates.items = this.validateAndSanitizeItems(updates.items);
    }

    portfolios[index] = {
      ...portfolios[index],
      ...sanitizedUpdates,
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
      const validatedItems = this.validateAndSanitizeItems(items);
      const autoSaveData = {
        items: validatedItems,
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
        return this.validateAndSanitizeItems(autoSaveData.items || []);
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
      const validatedItems = this.validateAndSanitizeItems(items);
      localStorage.setItem(this.CURRENT_PORTFOLIO_KEY, JSON.stringify(validatedItems));
    } catch (error) {
      console.error('Error saving current portfolio:', error);
    }
  }

  // Get current active portfolio
  getCurrentPortfolio(): SelectedItem[] | null {
    try {
      const data = localStorage.getItem(this.CURRENT_PORTFOLIO_KEY);
      return data ? this.validateAndSanitizeItems(JSON.parse(data)) : null;
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
      if (!data.name || typeof data.name !== 'string' || !Array.isArray(data.items)) {
        throw new Error('Invalid portfolio format');
      }

      const sanitizedName = sanitizeInputText(data.name, 100);
      const sanitizedDescription = typeof data.description === 'string'
        ? sanitizeInputText(data.description, 500)
        : undefined;

      const validatedItems = this.validateAndSanitizeItems(data.items);

      return this.savePortfolio(
        `${sanitizedName} (Imported)`,
        validatedItems,
        sanitizedDescription
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