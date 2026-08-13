# SP: pObtenerCodigoTercerIntentoArticulo
**Tipo**: Obtener
**Módulo**: Inventario

## Tablas Referenciadas
- [`saArticulo`](../tables/saArticulo.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04/20/2023>
-- Description:	<>
-- =============================================
CREATE PROCEDURE [dbo].[pObtenerCodigoTercerIntentoArticulo]
    (
	  @sCampoCodigo CHAR(30) ,
      @sCodigo CHAR(20) ,  
      @sTabla CHAR(30) ,
	  @sTipoDoc CHAR(6) = NULL,
	  @bAux BIT
    )
AS 
		BEGIN
		/*
		DECLARE @sql VARCHAR(MAx )
		
		SET @sql = 'SELECT TOP (1) ' + @sCampoCodigo + '
		FROM ' + @sTabla + '
		WHERE ' + ' ref = ''' + @sCodigo + '''' + ' OR ' + 'modelo LIKE ' + '''%' +  LTRIM(RTRIM(@sCodigo)) + '%''' +
		'  ORDER BY [anulado] , [art_des] , [co_art]  ASC  '
		print @sql
		 EXEC (@sql)
		*/
	   IF EXISTS (SELECT TOP (1) co_art  FROM saArticulo WHERE  ref =  @sCodigo ) 
	   begin
           SELECT TOP (1) co_art                        
			FROM saArticulo  WHERE  ref = @sCodigo--'5252H               '
			ORDER BY [anulado] , [art_des] , [co_art]  ASC 
		--	 print '0'
			 end
	   ELSE 
	   begin
	   --print '1'
	  -- print LTRIM(RTRIM(@sCodigo))
		   SELECT TOP (1) co_art FROM saArticulo  WHERE modelo LIKE '%'  +LTRIM(RTRIM(@sCodigo))+ '%'
		   ORDER BY [anulado] , [art_des] , [co_art]  ASC  

		   end
    END
```
