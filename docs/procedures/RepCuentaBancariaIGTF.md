# SP: RepCuentaBancariaIGTF
**Tipo**: Reporte
**Módulo**: Tesorería

## Tablas Referenciadas
- [`saCuentaBancaria`](../tables/saCuentaBancaria.md)
- [`saImpuestoCuentaBancaria`](../tables/saImpuestoCuentaBancaria.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		SOFTECH SISTEMAS
-- Create date: <05-04-10>
-- Description:	<Reporte Cuenta Bancaria Con Sus I.G.T.F>
-- =============================================
CREATE PROCEDURE [dbo].[RepCuentaBancariaIGTF]
	-- Add the parameters for the stored procedure here
    
    @sCo_Fecha_d SMALLDATETIME = NULL ,
    @sCo_Fecha_h SMALLDATETIME = NULL ,
	@sCo_Cuenta_d CHAR(6) = NULL , 
	@sCo_Cuenta_h CHAR(6) = null , 
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;
		
		SET @sCo_Fecha_d = dbo.FechaSimple(@sCo_Fecha_d)
    	SET @sCo_Fecha_h = dbo.FechaSimple(@sCo_Fecha_h)
        SELECT
            ICB.cod_cta ,num_cta ,fecha_regis ,valor_porcent
        FROM
           saImpuestoCuentaBancaria ICB
		INNER JOIN saCuentaBancaria CB ON CB.cod_cta = ICB.cod_cta
        WHERE
            ( 
			
			( @sCo_Cuenta_d IS NULL
                OR ICB.cod_cta >= @sCo_Cuenta_d
              )
              AND ( @sCo_Cuenta_h IS NULL
                    OR ICB.cod_cta <= @sCo_Cuenta_h
                  )
            )
           
       
				AND ( ( @sCo_Fecha_d IS NULL
                OR dbo.FechaSimple(ICB.fecha_regis) >= @sCo_Fecha_d
              )
              AND ( @sCo_Fecha_h IS NULL
                    OR dbo.FechaSimple(ICB.fecha_regis) <= @sCo_Fecha_h
                  )
            )
           
		    AND ( @sCo_Sucursal IS NULL
                  OR ICB.co_sucu_in = @sCo_Sucursal
                )
        ORDER BY 
            CASE @sDir
              WHEN 'DESC' THEN CASE @sCampOrderBy
                                 WHEN 'num_cta' THEN CB.num_cta
                                 ELSE ICB.cod_cta
                               END
            END DESC, CASE @sDir
                        WHEN 'ASC' THEN CASE @sCampOrderBy
                                          WHEN 'num_cta' THEN CB.num_cta
                                          ELSE ICB.cod_cta
                                        END
                      END ASC, fecha_regis DESC 
    END
```
