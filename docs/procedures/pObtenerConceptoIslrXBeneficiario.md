# SP: pObtenerConceptoIslrXBeneficiario
**Tipo**: Obtener
**Módulo**: Fiscal

## Tablas Referenciadas
- [`saBeneficiario`](../tables/saBeneficiario.md)
- [`saConISLR`](../tables/saConISLR.md)
- [`saTabuladorIslr`](../tables/saTabuladorIslr.md)
- [`saTabuladorIslrReng`](../tables/saTabuladorIslrReng.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pObtenerConceptoIslrXBeneficiario
*DESCRIPCIÓN	: Obtiene los concepto de ISLR segun el tipo de persona asociada al Beneficiario
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/

CREATE PROCEDURE [dbo].[pObtenerConceptoIslrXBeneficiario]
(
	@sTipo_per CHAR(1)
)
AS

	BEGIN
		SELECT DISTINCT concep.co_islr FROM saConISLR concep 

			INNER JOIN  saTabuladorIslRreng		tabReng		ON		concep.co_islr		=		tabReng.co_islr
			INNER JOIN  saTabuladorIslr			tab			ON		tab.co_tab			=		tabReng.co_tab
			INNER JOIN  saBeneficiario			ben			ON		tab.Tipo_per		=		@sTipo_per
END
```
