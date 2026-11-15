// Identifiers of the rdfc2im demo mine (HumanMine model, a panel of 113 human genes),
// shared by the specs. Every value here was checked against the mine's web service.
// Gene.primaryIdentifier is the NCBI gene id, Gene.secondaryIdentifier the Ensembl id;
// Protein.primaryAccession is the UniProt accession. See docs/building.md, "Cypress
// integration tests", for how to look up others.

// Two gene lists of four symbols that share exactly one gene (CYP2D6): their union has
// 7 genes, their intersection 1, the symmetric difference 6 and A minus B 3.
export const GENES_A = "PPARG, HFE, GSTP1, CYP2D6";
export const GENES_B = "CYP2D6, CYP3A4, CYP2C9, VKORC1";
export const GENES_A_SIZE = 4;
// Rows of the template Gene_Protein (gene, then its proteins) for GENES_A.
export const GENES_A_PROTEIN_ROWS = 135;

// Two proteins of the panel's genes: PPARG and CYP3A4.
export const PROTEINS = "P37231, P08684";

// A gene that has a report page with every section the specs look at.
export const GENE_SYMBOL = "PPARG";
export const GENE_PRIMARY_IDENTIFIER = "5468";
