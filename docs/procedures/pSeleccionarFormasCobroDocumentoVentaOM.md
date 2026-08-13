# SP: pSeleccionarFormasCobroDocumentoVentaOM
**Tipo**: Seleccionar
**Módulo**: Tesorería

## Tablas Referenciadas
- [`par_emp`](../tables/par_emp.md)
- [`saCliente`](../tables/saCliente.md)
- [`saCobro`](../tables/saCobro.md)
- [`saCobroDocReng`](../tables/saCobroDocReng.md)
- [`saDocumentoVenta`](../tables/saDocumentoVenta.md)
- [`saNCFInfoDocVenta`](../tables/saNCFInfoDocVenta.md)
- [`saSerie`](../tables/saSerie.md)
- [`saSerieTipo`](../tables/saSerieTipo.md)
- [`saSerieTipoExt`](../tables/saSerieTipoExt.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH CONSULTORES, C.A.
-- Create date: 26/03/2018
-- Actualizado: 28/02/2019
-- =============================================
--exec pp_rep_documentos_fpagos_detallado_do '20180601','20180630',6641,6641,0,99999999,'','þþþþþþþþþþþþþþþþþþþþþþþþþþþþþþ','','þþþþþþþþþþþþþþþþþþþþþþþþþþþþþþ'
--exec pSeleccionarFormasCobroDocumentoVenta_DOM '2019-01-01','2019-06-30','0000000036','0000000036',NULL,NULL,null,'14','14',NULL
--ALTER PROCEDURE [dbo].[pSeleccionarFormasCobroDocumentoVenta_DOM]
CREATE PROCEDURE [dbo].[pSeleccionarFormasCobroDocumentoVentaOM] 
	  @dDesde_d    SMALLDATETIME
	, @dDesde_h    SMALLDATETIME
	, @sDocDesde_d CHAR(20) = NULL
	, @sDocDesde_h CHAR(20) = NULL
	, @sCobDesde_d CHAR(20) = NULL
	, @sCobDesde_h CHAR(20) = NULL
	, @sCliente_d  CHAR(10) = NULL
	, @sCliente_h CHAR(10) = NULL
	, @sTipoComp_d CHAR(2)  = NULL
	, @sTipoComp_h CHAR(2)  = NULL
	, @sCosucu     CHAR(20) = NULL
	, @sCo_Moneda_Rep   CHAR (6) = NULL
	, @sCo_Moneda   CHAR (6) = NULL
	, @sCampOrderBy VARCHAR(16) = NULL 
    , @sDir VARCHAR(6) = NULL

 AS
       
    SELECT @dDesde_h = DATEADD(MINUTE, -1, DATEADD(DAY, 1, @dDesde_h))

    ---------------------------------------------------------------------------------------------------------------------------------------
	DECLARE @todosDocu BIT
		,@todosCob BIT
		,@todosClie BIT
		,@todosComp BIT
		,@todasSucu BIT
	
	--SET @sDocDesde_d = COALESCE(@sDocDesde_d, '')
	--SET @sDocDesde_h = COALESCE(@sDocDesde_h, '')
	--SET @sCobDesde_d = COALESCE(@sCobDesde_d, '')
	--SET @sCobDesde_h = COALESCE(@sCobDesde_h, '')
	SET @sCliente_d = COALESCE(@sCliente_d, '')
	SET @sCliente_h = COALESCE(@sCliente_h, '')
	SET @sTipoComp_d = COALESCE(@sTipoComp_d, '')
	SET @sTipoComp_h = COALESCE(@sTipoComp_h, '')
	SET @sCosucu = COALESCE(@sCosucu, '')
	
	--SET @todosDocu = (CASE WHEN @sDocDesde_d <> '' THEN
	--	CASE WHEN @sDocDesde_h <> '' THEN 0 ELSE 1 END
	--	ELSE 1 END)
		
	--SET @todosCob = (CASE WHEN @sCobDesde_d <> '' THEN
	--	CASE WHEN @sCobDesde_h <> '' THEN 0 ELSE 1 END
	--	ELSE 1 END)
		
	SET @todosClie = (CASE WHEN @sCliente_d <> '' THEN
		CASE WHEN @sCliente_h <> '' THEN 0 ELSE 1 END
		ELSE 1 END)
	
	SET @todosComp = (CASE WHEN @sTipoComp_d <> '' THEN
		CASE WHEN @sTipoComp_h <> '' THEN 0 ELSE 1 END
		ELSE 1 END)
		
	SET @todasSucu = (CASE WHEN @sCosucu <> '' THEN 0 ELSE 1 END)
	-----------------------------------------------
```
