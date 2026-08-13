# SP: pvRepEtiquetaBalanza
**Tipo**: Punto de Venta
**Módulo**: Punto de Venta

## Tablas Referenciadas
- [`pvEtiquetaBalanza`](../tables/pvEtiquetaBalanza.md)

## Código (excerpt)
```sql
/**************************************************************************
*NOMBRE			: pvRepEtiquetaBalanza
*DESCRIPCIÓN	: Reporte de Etiqueta para Balanza de Punto de Venta
*AUTOR			: SOFTECH SISTEMAS
***************************************************************************/ 
CREATE PROCEDURE [dbo].[pvRepEtiquetaBalanza] 
    @sCo_Etiqueta_d char(10)= NULL  ,
    @sCo_Etiqueta_h char(10)= NULL  ,    
    @sCo_Sucursal CHAR(6) = NULL ,    
    @sActivo char(2)  =NULL ,
	@sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
    				
AS 
    BEGIN
	   --CASE WHEN  @sActivo = 1
	   --(case when  @sActivo = 'SI' then '1' when @sActivo = 'NO' then '0' end)
 
       SELECT
			co_etiqueta, des_etiqueta, pre+cod+suf+ ent+dec+adic as dimencion,pre,cod,suf, ent+dec as Peso,
			ent,dec,adic, (case when activo = '1' then 'Activo' when activo = '0' then 'Inactivo' when activo is null then 'Inactivo' end) as activo 
       FROM
			pvEtiquetaBalanza 
       WHERE
            (( @sCo_Etiqueta_d IS NULL
              or   co_etiqueta >= @sCo_Etiqueta_d
              )
			and (@sCo_Etiqueta_h IS NULL 
			OR co_etiqueta <= @sCo_Etiqueta_h)
			)
            AND (@sActivo is null OR activo = @sActivo)
       ORDER BY
			CASE @sDir
				 WHEN 'DESC' THEN 
					CASE @sCampOrderBy
                         WHEN 'des_etiqueta' THEN des_etiqueta
                         ELSE co_etiqueta
                    END
				  END DESC, 
			CASE @sDir
                 WHEN 'ASC' THEN 
					CASE @sCampOrderBy
                         WHEN 'des_etiqueta' THEN des_etiqueta
                         ELSE co_etiqueta
                    END
             END ASC
 END
```
