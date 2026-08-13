# SP: RepSaldoProveedorxZona
**Tipo**: Reporte
**Módulo**: Clientes

## Tablas Referenciadas
- [`saProveedor`](../tables/saProveedor.md)
- [`saZona`](../tables/saZona.md)

## Código (excerpt)
```sql
-- =============================================
-- Author:		<SoftechConsultores>
-- Create date: <29-07-10>
-- Description:	<Saldo de Proveedores por Zona>
-- =============================================
CREATE PROCEDURE [RepSaldoProveedorxZona]
	-- Add the parameters for the stored procedure here
    @sCo_Pro_d CHAR(16) = NULL ,
    @sCo_Pro_h CHAR(16) = NULL ,
    @sCo_Des_d CHAR(100) = NULL ,
    @sCo_Des_h CHAR(100) = NULL ,
    @sCo_TipPro_d CHAR(6) = NULL ,
    @sCo_TipPro_h CHAR(6) = NULL ,
    @sCo_Zon_d CHAR(6) = NULL ,
    @sCo_Zon_h CHAR(6) = NULL ,
    @sCo_Seg_d CHAR(6) = NULL ,
    @sCo_Seg_h CHAR(6) = NULL ,
    @sdFec_Emis SMALLDATETIME = NULL ,
    @sNivel_Saldo CHAR(6) = NULL ,
    @sCo_Moneda CHAR(6) = NULL ,
    @sCo_Sucursal CHAR(6) = NULL ,
    @sCampOrderBy VARCHAR(16) = NULL ,
    @sDir VARCHAR(6) = NULL ,
    @bHeaderRep BIT = 0
AS 
    BEGIN
        SET NOCOUNT ON ;

        IF ( @sNivel_Saldo IS NULL ) 
            SET @sNivel_Saldo = 'TODO'

        IF @sdFec_Emis IS NOT NULL 
            SET @sdFec_Emis = DATEADD(ss, -1, DATEADD(day, 1, @sdFec_Emis))

        SELECT
            P.*, Z.zon_des, ISNULL(dbo.SaldoProveedorAUnaFecha(P.co_prov, @sdFec_Emis + 1), 0) AS saldo
        FROM
            saProveedor AS P
            INNER JOIN saZona AS Z ON Z.co_zon = P.co_zon
        WHERE
            ( ( @sCo_Pro_d IS NULL
                OR P.co_prov >= @sCo_Pro_d
              )
              AND ( @sCo_Pro_h IS NULL
                    OR P.co_prov <= @sCo_Pro_h
                  )
            )
            AND ( ( @sCo_Des_d IS NULL
                    OR P.prov_des >= @sCo_Des_d
                  )
                  AND ( @sCo_Des_h IS NULL
                        OR P.prov_des <= @sCo_Des_h
                      )
                )
            AND ( ( @sCo_TipPro_d IS NULL
                    OR P.tip_pro >= @sCo_TipPro_d
                  )
                  AND ( @sCo_TipPro_h IS NULL
                        OR P.tip_pro <= @sCo_TipPro_h
                      )
                )
            AND ( ( @sCo_Zon_d IS NULL
                    OR P.co_zon >= @sCo_Zon_d
                  )
                  AND ( @sCo_Zon_h IS NULL
                        OR P.co_zon <= @sCo_Zon_h
                      )
                )
            AND ( ( @sCo_Seg_d IS NULL
                    OR P.co_seg >= @sCo_Seg_d
                  )
                  AND ( @sCo_Seg_h IS NU
```
