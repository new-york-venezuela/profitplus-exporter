# SP: RepTipoDocumentoCompraVenta
**Tipo**: Reporte
**Módulo**: Compras

## Tablas Referenciadas
- [`saTipoDocumento`](../tables/saTipoDocumento.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: 08-08-15
-- Description:	<Listado de Tipo de Documento para Compras y Ventas>
-- =============================================
CREATE PROCEDURE [dbo].[RepTipoDocumentoCompraVenta] 
	-- Add the parameters for the stored procedure here
	@sCo_Tipo_Doc_d CHAR(6) = NULL , 
	@ScO_Tipo_Doc_h CHAR(6) = NULL ,
	@sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0 ,
    @sNombreDBMaestra VARCHAR(max) 


AS
BEGIN
	SET NOCOUNT ON;

	declare @query NVARCHAR(max)
	set @query = 'select co_fijo, co_grupo, desc_fijo, producto from '+ @sNombreDBMaestra +'.[dbo].[MpFijo]'

DECLARE @TablaFijos TABLE
	     (
		  co_fijo char(4),
		  co_grupo char(3),
		  desc_fijo varchar(60),
		  producto char(6)
		  )
insert into
@TablaFijos
EXEC sp_executesql @query

	SELECT TD.co_tipo_doc, TD.descrip, TD.tipo_mov, TD.usar_ventas, TD.usar_compras, TD.tipo_imp,
	(select desc_fijo from @TablaFijos where producto= 'ADMI' AND co_grupo='ISV' AND co_fijo = TD.tipo_imp) as desc_iva, 
	(select desc_fijo from @TablaFijos where producto= 'ADMI' AND co_grupo='MCD' AND co_fijo = TD.tipo_mov) as desc_tipo
	
	FROM [dbo].[saTipoDocumento] TD
	
	WHERE
	     ((@sCo_Tipo_Doc_d IS NULL OR @sCo_tipo_Doc_d >= co_tipo_doc)
		  AND (@sCo_Tipo_Doc_h IS NULL OR @sCo_Tipo_Doc_h <= co_tipo_doc))
		 AND ( @sCo_Sucursal IS NULL OR co_sucu_in = @sCo_Sucursal)
   ORDER BY 
      CASE @sDir
	      WHEN 'DESC' THEN CASE @sCampOrderBy 
		                   WHEN 'descrip' THEN descrip 
						   ELSE co_tipo_doc
						END
	END DESC,
	CASE @sDir
	   WHEN 'ASC' THEN CASE @sCampOrderBy
									WHEN 'descrip' THEN descrip
									ELSE co_tipo_doc
								END

	     END ASC        		 
END
```
