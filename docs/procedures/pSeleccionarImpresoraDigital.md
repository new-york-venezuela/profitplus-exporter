# SP: pSeleccionarImpresoraDigital
**Tipo**: Seleccionar
**Módulo**: General

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pActualizaraAreaImpresion
*DESCRIPCIÓN	: Actualiza Area de Impresion
*AUTOR			: SOFTECH SISTEMAS
**************************************************************************/
CREATE PROCEDURE [dbo].[pSeleccionarImpresoraDigital]
	( @sco_impdig varchar (6) )
AS 
    BEGIN	
    Select co_impdig, des_impdig, co_pais, estado from saImpDigital
END
/* Se valida la existencia de los SP utilizados para contabilización de comprobantes */
IF EXISTS (SELECT * FROM   dbo.sysobjects WHERE  name = 'pSeleccionarContabilizacionAjusteNegativoPositivoVenta' AND type = 'P')
                DROP PROCEDURE [dbo].[pSeleccionarContabilizacionAjusteNegativoPositivoVenta]
```
