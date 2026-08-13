# SP: pActualizarRenglonConcBancaria
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saConcBanco`](../tables/saConcBanco.md)

## Código (excerpt)
```sql
/********************************************************************************************************
*NOMBRE			:	pActualizarRenglonConcBancaria
*DESCRIPCION	:	Actualiza los movimientos bancarios de acuerdo a su estado de conciliacion	
*AUTOR			:	SOFTECH SISTEMAS
********************************************************************************************************/

CREATE PROCEDURE [pActualizarRenglonConcBancaria]
    (
      @iPkRengNum INT ,
      @sCo_Auto_Con CHAR(6) ,
      @bConciliado BIT ,
      @sMov_Num CHAR(20) ,
      @sco_sucu_mo CHAR(6) ,
      @sco_us_mo CHAR(6)
    )
AS 
    BEGIN
        IF ( @bConciliado = 1 ) 
            BEGIN	
			--Si no existe algun registro le asigno el numero 1 por defecto al Reng_Num
			
                INSERT  INTO saConcBanco
                        ( reng_num, co_auto_con, mov_num, fec_conc, con_auto, co_us_in, co_sucu_in, fe_us_in, co_us_mo,
                          co_sucu_mo, fe_us_mo )
                VALUES
                        ( @iPkRengNum, @sCo_Auto_Con, @sMov_Num, GETDATE(), 0, @sco_us_mo, @sco_sucu_mo, GETDATE(),
                          @sco_us_mo, @sco_sucu_mo, GETDATE() )
            END
        ELSE 
            BEGIN
                DELETE FROM
                    saConcBanco
                WHERE
                    co_auto_con = @sCo_Auto_Con
                    AND mov_num = @sMov_Num
                    AND reng_num = @iPkRengNum
            END
    END
```
