# SP: RepTarjetaCreditoConTipo
**Tipo**: Reporte
**Módulo**: General

## Tablas Referenciadas
- [`pvTarjetaCreditoExt`](../tables/pvTarjetaCreditoExt.md)
- [`pvTipoTarjeta`](../tables/pvTipoTarjeta.md)
- [`saTarjetaCredito`](../tables/saTarjetaCredito.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <04-03-13>
-- Description:	<Reportes de Tarjetas de Creditos con su Tipo>
-- =============================================
CREATE PROCEDURE [dbo].[RepTarjetaCreditoConTipo]
	-- Add the parameters for the stored procedure here
    @sCo_Tarjeta_d CHAR(6) = NULL ,
    @sCo_Tarjeta_h CHAR(6) = NULL ,
    @sCo_DescripcionTipo CHAR(20) = NULL ,    
    @sCampOrderBy VARCHAR(6) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;       
        SELECT
            a.co_tar, a.des_tar,  tt.DescripcionTipo
        FROM
            saTarjetaCredito as a
            
            inner join pvTarjetaCreditoExt as tc on tc.rowguid_co_tar = a.rowguid
            inner join pvTipoTarjeta as tt on tt.Rowguid = tc.rowguid_co_tipo_tar
        WHERE
            ( ( @sCo_Tarjeta_d IS NULL
                OR a.co_tar >= @sCo_Tarjeta_d
              )
              AND ( @sCo_Tarjeta_h IS NULL
                    OR a.co_tar <= @sCo_Tarjeta_h
                  )
                      
             AND ( @sCo_DescripcionTipo IS NULL
                  OR tt.tipotarjeta  = @sCo_DescripcionTipo
                )            
            )
                
        ORDER BY
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'des_tar' THEN a.des_tar
                                 ELSE a.co_tar
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'des_tar' THEN a.des_tar
                                          ELSE a.co_tar
                                        END
                      END ASC
    END
```
