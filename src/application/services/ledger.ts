import { db } from '@/infrastructure/db/client';
import { ledgerAccounts, ledgerEntries, ledgerLines } from '@/infrastructure/db/schema';
import { eq } from 'drizzle-orm';
import { validateLedgerEntry, UnvalidatedLedgerLine } from '@/domain/ledger/validation';

export class LedgerService {
  // Ensure a ledger account exists, creating it if necessary
  async ensureAccount(path: string, name: string, type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'): Promise<void> {
    const existing = await db.query.ledgerAccounts.findFirst({
      where: eq(ledgerAccounts.id, path),
    });

    if (!existing) {
      await db.insert(ledgerAccounts).values({
        id: path,
        name,
        type,
      });
    }
  }

  // Create a double-entry ledger entry
  async postEntry(
    description: string,
    lines: UnvalidatedLedgerLine[],
    referenceType?: string,
    referenceId?: string
  ): Promise<string> {
    // 1. Domain Validation
    validateLedgerEntry(lines);

    // 2. Database transaction
    return await db.transaction(async (tx) => {
      // Create parent entry
      const [entry] = await tx
        .insert(ledgerEntries)
        .values({
          description,
          referenceType,
          referenceId,
        })
        .returning();

      // Create lines
      for (const line of lines) {
        // Ensure the account exists in DB (default name and type inferred from path)
        const accountExists = await tx.query.ledgerAccounts.findFirst({
          where: eq(ledgerAccounts.id, line.accountPath),
        });

        if (!accountExists) {
          // Infer account type from path root (e.g. "assets:..." -> asset)
          let inferredType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' = 'asset';
          const rootNamespace = line.accountPath.split(':')[0];
          if (rootNamespace === 'liabilities') inferredType = 'liability';
          else if (rootNamespace === 'equity') inferredType = 'equity';
          else if (rootNamespace === 'revenue') inferredType = 'revenue';
          else if (rootNamespace === 'expense') inferredType = 'expense';

          await tx.insert(ledgerAccounts).values({
            id: line.accountPath,
            name: line.accountPath.split(':').pop() || line.accountPath,
            type: inferredType,
          });
        }

        await tx.insert(ledgerLines).values({
          entryId: entry.id,
          accountPath: line.accountPath,
          amount: line.amount,
          direction: line.direction,
        });
      }

      return entry.id;
    });
  }

  // Get account balances
  async getAccountBalances(): Promise<{ accountPath: string; balance: string }[]> {
    const lines = await db.query.ledgerLines.findMany();
    
    // Group and calculate balances
    const balancesMap: Record<string, number> = {};
    for (const line of lines) {
      const amt = parseFloat(line.amount);
      if (!balancesMap[line.accountPath]) {
        balancesMap[line.accountPath] = 0;
      }
      if (line.direction === 'debit') {
        balancesMap[line.accountPath] += amt;
      } else {
        balancesMap[line.accountPath] -= amt;
      }
    }

    return Object.entries(balancesMap).map(([accountPath, balance]) => ({
      accountPath,
      balance: balance.toFixed(4),
    }));
  }

  // Get audit journal entries
  async getJournalEntries() {
    return await db.query.ledgerEntries.findMany({
      orderBy: (entries, { desc }) => [desc(entries.postedAt)],
      with: {
        lines: true,
      },
    });
  }
}

export const ledgerService = new LedgerService();
