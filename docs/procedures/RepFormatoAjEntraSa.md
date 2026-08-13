# SP: RepFormatoAjEntraSa
**Tipo**: Reporte
**Módulo**: Inventario

## Tablas Referenciadas
- [`saAjuste`](../tables/saAjuste.md)
- [`saAjusteReng`](../tables/saAjusteReng.md)
- [`saArticulo`](../tables/saArticulo.md)
- [`saTipoAjuste`](../tables/saTipoAjuste.md)

## Código (excerpt)
```sql
/*=============================================
 Author:		SOFTECH SISTEMAS
 Create date:   <03-05-10>
 Description:	<Formato de Ajuste de Entrada y Salida>
 =============================================*/
CREATE PROCEDURE [RepFormatoAjEntraSa]
	-- Add the parameters for the stored procedure here
    @sNum_Ajuste_d CHAR(20) = NULL ,
    @sNum_Ajuste_h CHAR(20) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        SELECT
            TA.tipo_trans, CASE WHEN TA.tipo_trans = 1 THEN AJR.total_art * -1
                                ELSE AJR.total_art
                           END AS Total_art_reng, AJR.cost_unit AS Costo_Unit_reng, ARTE.art_des AS art_des_reng,
            ARTE.modelo AS modelo_art_reng, AJ.*, AJR.*, AJ.anulado
        FROM
            saAjuste AS AJ
            INNER JOIN saAjusteReng AS AJR ON AJ.ajue_num = AJR.ajue_num
            INNER JOIN saArticulo AS ARTE ON ARTE.co_art = AJR.co_art
            LEFT JOIN saTipoAjuste AS TA ON TA.co_tipo = AJR.co_tipo
        WHERE
            ( ( @sNum_Ajuste_d IS NULL
                OR AJ.ajue_num >= @sNum_Ajuste_d
              )
              AND ( @sNum_Ajuste_h IS NULL
                    OR AJ.ajue_num <= @sNum_Ajuste_h
                  )
            )
            AND ( AJ.anulado = 0 )
            AND ( @sCo_Sucursal IS NULL
                  OR AJ.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY
            AJ.ajue_num

    END
```
